import fs from "fs";
import path from "path";

const adminStoragePath = path.join(process.cwd(), "server", "admin-storage.ts");
let content = fs.readFileSync(adminStoragePath, "utf-8");

// Ensure crypto import exists
if (!content.includes('import crypto from "crypto";')) {
  content = `import crypto from "crypto";\n` + content;
}

// Fix adminCreateBook
content = content.replace(
  /const \[book\] = await db\.insert\(books\)\.values\(data\);\s*return book;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(books).values({ id, ...data } as any);
  const [book] = await db.select().from(books).where(eq(books.id, id));
  return book;`,
);

// Fix adminUpdateBook
content = content.replace(
  /const \[book\] = await db\s*\n?\s*\.update\(books\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(books\.id, id\)\)\s*;\s*return book \|\| undefined;/g,
  `await db.update(books).set({ ...data, updatedAt: new Date() }).where(eq(books.id, id));
  const [book] = await db.select().from(books).where(eq(books.id, id));
  return book || undefined;`,
);

// Fix adminCreateChapter
content = content.replace(
  /const \[ch\] = await db\.insert\(chapters\)\.values\(data\);\s*return ch;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(chapters).values({ id, ...data } as any);
  const [ch] = await db.select().from(chapters).where(eq(chapters.id, id));
  return ch;`,
);

// Fix adminUpdateChapter
content = content.replace(
  /const \[ch\] = await db\s*\n?\s*\.update\(chapters\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(chapters\.id, id\)\)\s*;\s*return ch \|\| undefined;/g,
  `await db.update(chapters).set({ ...data, updatedAt: new Date() }).where(eq(chapters.id, id));
  const [ch] = await db.select().from(chapters).where(eq(chapters.id, id));
  return ch || undefined;`,
);

// Fix adminCreateTopic
content = content.replace(
  /const \[t\] = await db\.insert\(topics\)\.values\(data\);\s*return t;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(topics).values({ id, ...data } as any);
  const [t] = await db.select().from(topics).where(eq(topics.id, id));
  return t;`,
);

// Fix adminUpdateTopic
content = content.replace(
  /const \[t\] = await db\s*\n?\s*\.update\(topics\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(topics\.id, id\)\)\s*;\s*return t \|\| undefined;/g,
  `await db.update(topics).set({ ...data, updatedAt: new Date() }).where(eq(topics.id, id));
  const [t] = await db.select().from(topics).where(eq(topics.id, id));
  return t || undefined;`,
);

// Fix adminCreateContentBlock
content = content.replace(
  /const \[cb\] = await db\.insert\(contentBlocks\)\.values\(data\);\s*return cb;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(contentBlocks).values({ id, ...data } as any);
  const [cb] = await db.select().from(contentBlocks).where(eq(contentBlocks.id, id));
  return cb;`,
);

// Fix adminUpdateContentBlock
content = content.replace(
  /const \[cb\] = await db\s*\n?\s*\.update\(contentBlocks\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(contentBlocks\.id, id\)\)\s*;\s*return cb \|\| undefined;/g,
  `await db.update(contentBlocks).set({ ...data, updatedAt: new Date() }).where(eq(contentBlocks.id, id));
  const [cb] = await db.select().from(contentBlocks).where(eq(contentBlocks.id, id));
  return cb || undefined;`,
);

// Fix adminCreateMCQ
content = content.replace(
  /const \[m\] = await db\.insert\(mcqs\)\.values\(data\);\s*return m;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(mcqs).values({ id, ...data } as any);
  const [m] = await db.select().from(mcqs).where(eq(mcqs.id, id));
  return m;`,
);

// Fix adminUpdateMCQ
content = content.replace(
  /const \[m\] = await db\s*\n?\s*\.update\(mcqs\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(mcqs\.id, id\)\)\s*;\s*return m \|\| undefined;/g,
  `await db.update(mcqs).set({ ...data, updatedAt: new Date() }).where(eq(mcqs.id, id));
  const [m] = await db.select().from(mcqs).where(eq(mcqs.id, id));
  return m || undefined;`,
);

// Fix adminCreateAnnouncement
content = content.replace(
  /const \[a\] = await db\.insert\(announcements\)\.values\(data\);\s*return a;/g,
  `const id = (data as any).id || crypto.randomUUID();
  await db.insert(announcements).values({ id, ...data } as any);
  const [a] = await db.select().from(announcements).where(eq(announcements.id, id));
  return a;`,
);

// Fix adminUpdateAnnouncement
content = content.replace(
  /const \[a\] = await db\s*\n?\s*\.update\(announcements\)\s*\n?\s*\.set\(\{ \.\.\.data, updatedAt: new Date\(\) \}\)\s*\n?\s*\.where\(eq\(announcements\.id, id\)\)\s*;\s*return a \|\| undefined;/g,
  `await db.update(announcements).set({ ...data, updatedAt: new Date() }).where(eq(announcements.id, id));
  const [a] = await db.select().from(announcements).where(eq(announcements.id, id));
  return a || undefined;`,
);

fs.writeFileSync(adminStoragePath, content, "utf-8");
console.log("Updated admin-storage.ts MySQL helpers successfully!");
