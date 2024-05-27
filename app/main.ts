import * as net from "net"

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
    this.headers = headers ?? {}
    this.body = body ?? ""
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
        headers[key] = value
      }
    }

    return new Request(method, target, version, headers, body)
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
}

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const req = Request.parse(data.toString())

    if (req.target === "/") {
      const res = new Response("HTTP/1.1", 200, "OK")
      socket.write(res.toString())
    } else if (req.target.startsWith("/echo/")) {
      const str = req.target.slice(6)
      const res = new Response(
        "HTTP/1.1",
        200,
        "OK",
        {
          "Content-Type": "text/plain",
          "Content-Length": String(str.length),
        },
        str
      )

      socket.write(res.toString())
    } else {
      const res = new Response("HTTP/1.1", 404, "Not Found")
      socket.write(res.toString())
    }
    socket.end()
  })
})

server.listen(4221, "localhost", () => {
  console.log("Server is running on port 4221")
})
