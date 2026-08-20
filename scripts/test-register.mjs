async function test() {
  const randomSuffix = Math.floor(Math.random() * 10000);
  const email = `testuser${randomSuffix}@maternalmind.app`;
  console.log(`[*] Testing registration for ${email}...`);

  const res = await fetch("https://maternalmind.com.pk/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Password123!",
      name: `Test User ${randomSuffix}`,
    }),
  });

  console.log("Registration Status:", res.status);
  const data = await res.json();
  console.log("Registration Response:", data);
}

test().catch(console.error);
