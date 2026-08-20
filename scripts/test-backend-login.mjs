import http from "http";

const payload = JSON.stringify({
  email: "drfarzanamuneer1@gmail.com",
  password: "Admin@123456",
});

const req = http.request(
  {
    hostname: "127.0.0.1",
    port: 5000,
    path: "/api/auth/login",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    console.log("Status:", res.statusCode);
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => console.log("Body:", body));
  }
);

req.on("error", console.error);
req.write(payload);
req.end();
