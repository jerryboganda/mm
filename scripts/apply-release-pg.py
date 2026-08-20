import subprocess
import sys
import os

release_sql = "/opt/docker/maternal-mind/content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/release.sql"
if not os.path.exists(release_sql):
    print("Release SQL not found:", release_sql)
    sys.exit(1)

with open(release_sql, "r", encoding="utf-8") as f:
    sql = f.read()

pg_sql = sql.replace("`order`", '"order"')

p = subprocess.Popen(
    ["docker", "exec", "-i", "platform-postgres", "psql", "-U", "maternal_mind", "-d", "maternal_mind"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
stdout, stderr = p.communicate(pg_sql.encode("utf-8"))

print("STDOUT:", stdout.decode("utf-8")[-200:])
if stderr:
    print("STDERR:", stderr.decode("utf-8"))

if p.returncode == 0:
    print("\n[+] SUCCESS: Authoritative parity release applied to VPS PostgreSQL database!")
else:
    print("\n[-] FAILED with code:", p.returncode)
    sys.exit(p.returncode)
