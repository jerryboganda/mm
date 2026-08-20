async function test() {
  const res = await fetch("https://maternalmind.com.pk/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "drfarzanamuneer1@gmail.com",
      password: "Admin@123456",
    }),
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Response JSON:", data);
}

test().catch(console.error);
