async function main() {
  const res = await fetch("https://maternalmind.com.pk/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "drfarzanamuneer1@gmail.com", password: "Admin@123456" }),
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  console.log("Body:", await res.json());
}
main();
