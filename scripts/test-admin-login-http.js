import http from "http";

const postData = JSON.stringify({
  email: "demo@maternalmind.app",
  password: "Demo@123",
});

const req = http.request(
  {
    hostname: "localhost",
    port: 5000,
    path: "/api/auth/login",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      console.log("HTTP STATUS:", res.statusCode);
      console.log("RESPONSE BODY:", data);
      console.log("COOKIE HEADERS:", res.headers["set-cookie"]);
    });
  }
);

req.on("error", (e) => console.error(e));
req.write(postData);
req.end();
