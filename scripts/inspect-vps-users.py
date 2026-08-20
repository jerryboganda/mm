import subprocess

p = subprocess.Popen(
    ["docker", "exec", "-i", "platform-postgres", "psql", "-U", "maternal_mind", "-d", "maternal_mind", "-c", "SELECT id, email, role, password, is_active, is_email_verified FROM users WHERE email LIKE '%drfarzanamuneer%' OR email LIKE '%demo%';"],
    stdout=subprocess.PIPE,
)
stdout, _ = p.communicate()
print(stdout.decode("utf-8"))
