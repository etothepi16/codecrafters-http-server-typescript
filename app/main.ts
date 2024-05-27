import * as net from "net"

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const reqComponents = data.toString().split("\r\n")
    const requestLine = reqComponents[0].split(" ")
    const requestTarget = requestLine[1]

    if (requestTarget === "/") {
      socket.write("HTTP/1.1 200 OK\r\n\r\n")
    } else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n")
    }
    socket.end()
  })
})

server.listen(4221, "localhost", () => {
  console.log("Server is running on port 4221")
})
