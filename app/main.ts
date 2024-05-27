import * as fs from "fs"
import * as net from "net"

function normalizeHeaderName(name: string): string {
  return name
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join("-")
}

class Request {
  method: string
  target: string
  version: string
  headers?: Record<string, string>
  body?: string

  constructor(
    method: string,
    target: string,
    version: string,
    headers?: Record<string, string>,
    body?: string
  ) {
    this.method = method
    this.target = target
    this.version = version
    // Headers are case-insensitive, so we normalize them to Title-Case
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this.setHeader(key, value)
      }
    }
    this.headers = headers ?? {}
    this.body = body ?? ""
  }

  private setHeader(name: string, value: string) {
    if (!this.headers) {
      this.headers = {}
    }
    name = normalizeHeaderName(name)
    this.headers[name] = value
  }

  static parse(requestString: string): Request {
    const [requestLine, ...headerAndBody] = requestString.split("\r\n")
    const [method, target, version] = requestLine.split(" ")

    const headers: Record<string, string> = {}
    let body = ""
    let bodyStarted = false
    for (const line of headerAndBody) {
      if (bodyStarted) {
        body += line
      } else if (line === "") {
        bodyStarted = true
      } else {
        const [key, value] = line.split(": ")
        headers[normalizeHeaderName(key)] = value
      }
    }

    return new Request(method, target, version, headers, body)
  }

  getHeader(name: string): string | undefined {
    if (!this.headers) {
      return undefined
    }
    return this.headers[normalizeHeaderName(name)]
  }
}

class Response {
  version: string
  statusCode: number
  reasonPhrase?: string
  headers?: Record<string, string>
  body?: string

  constructor(
    version: string,
    statusCode: number,
    reasonPhrase?: string,
    headers?: Record<string, string>,
    body?: string
  ) {
    this.version = version
    this.statusCode = statusCode
    this.reasonPhrase = reasonPhrase ?? ""
    // Headers are case-insensitive, so we normalize them to Title-Case
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this.setHeader(key, value)
      }
    }
    this.headers = headers ?? {}
    this.body = body ?? ""
  }

  toString(): string {
    let responseString = `${this.version} ${this.statusCode} ${this.reasonPhrase}\r\n`
    if (this.headers) {
      for (const [key, value] of Object.entries(this.headers)) {
        responseString += `${key}: ${value}\r\n`
      }
    }
    responseString += "\r\n"
    responseString += this.body
    return responseString
  }

  getHeader(name: string): string | undefined {
    if (!this.headers) {
      return undefined
    }
    return this.headers[normalizeHeaderName(name)]
  }

  private setHeader(name: string, value: string) {
    if (!this.headers) {
      this.headers = {}
    }
    name = normalizeHeaderName(name)
    this.headers[name] = value
  }
}

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const req = Request.parse(data.toString())
    let res
    if (req.target === "/") {
      res = new Response("HTTP/1.1", 200, "OK")
    } else if (req.target.startsWith("/echo/")) {
      const str = req.target.slice(6)
      res = new Response(
        "HTTP/1.1",
        200,
        "OK",
        {
          "Content-Type": "text/plain",
          "Content-Length": String(str.length),
        },
        str
      )
    } else if (req.target === "/user-agent") {
      if (!req.headers) {
        res = new Response("HTTP/1.1", 400, "Bad Request")
        socket.write(res.toString())
        return
      }
      const userAgent = req.getHeader("User-Agent")
      if (!userAgent) {
        res = new Response("HTTP/1.1", 400, "Bad Request")
        socket.write(res.toString())
        return
      }
      res = new Response(
        "HTTP/1.1",
        200,
        "OK",
        {
          "Content-Type": "text/plain",
          "Content-Length": String(userAgent.length),
        },
        userAgent
      )
    } else if (req.target.startsWith("/files/")) {
      const fileName = req.target.slice(7)
      const args = process.argv.slice(2)
      const absPath = args[1]
      const filePath = `${absPath}/${fileName}`
      if (req.method == "GET") {
        try {
          const data = fs.readFileSync(filePath, "utf-8")
          res = new Response(
            "HTTP/1.1",
            200,
            "OK",
            {
              "Content-Type": "application/octet-stream",
              "Content-Length": String(data.length),
            },
            data
          )
        } catch (err) {
          res = new Response("HTTP/1.1", 404, "Not Found")
        }
      } else if (req.method == "POST") {
        const data = req.body
        if (!data) {
          res = new Response("HTTP/1.1", 400, "Bad Request")
          socket.write(res.toString())
          return
        }

        try {
          fs.writeFileSync(filePath, data)
          res = new Response("HTTP/1.1", 201, "Created")
        } catch (err) {
          res = new Response("HTTP/1.1", 500, "Internal Server Error")
        }
      } else {
        res = new Response("HTTP/1.1", 405, "Method Not Allowed")
      }
    } else {
      res = new Response("HTTP/1.1", 404, "Not Found")
    }
    socket.write(res.toString())
    socket.end()
  })
})

server.listen(4221, "localhost", () => {
  console.log("Server is running on port 4221")
})
