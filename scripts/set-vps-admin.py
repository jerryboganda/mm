import subprocess

sql = """
UPDATE users
SET role = 'admin', is_active = true, is_email_verified = true, password = '$2b$10$jux.WXVZOl.byfrk8Ocoku3DNDjGhmcaCdoU2QMl3jELkWjztyToS'
WHERE email = 'drfarzanamuneer1@gmail.com';
"""

p = subprocess.Popen(
    ["docker", "exec", "-i", "platform-postgres", "psql", "-U", "maternal_mind", "-d", "maternal_mind"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
stdout, stderr = p.communicate(sql.encode("utf-8"))
print("STDOUT:", stdout.decode("utf-8"))
if stderr:
    print("STDERR:", stderr.decode("utf-8"))
