-- ═══════════════════════════════════════════════════════════════
-- Maternal Mind — Complete Demo Seed Data
-- OB-GYN Learning Platform with realistic medical content
-- ═══════════════════════════════════════════════════════════════

-- ── Create all tables ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  subscription_status TEXT NOT NULL DEFAULT 'none',
  subscription_plan TEXT,
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_token TEXT,
  email_token_expires_at TIMESTAMP,
  phone_number TEXT,
  is_phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verification_token TEXT,
  phone_token_expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id VARCHAR NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id VARCHAR NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  author TEXT,
  source TEXT,
  "references" TEXT,
  last_reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id VARCHAR NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcqs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id VARCHAR NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  option_explanations JSONB,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  "references" TEXT,
  tags JSONB,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_progress (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id VARCHAR NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id VARCHAR NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id VARCHAR REFERENCES topics(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  wrong_count INTEGER NOT NULL,
  time_taken INTEGER,
  answers JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recent_activity (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id VARCHAR NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mcq_id VARCHAR NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  ease_factor INTEGER NOT NULL DEFAULT 250,
  "interval" INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id VARCHAR NOT NULL,
  report_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- DEMO USER (password: Demo@123)
-- bcrypt hash of "Demo@123"
-- ═══════════════════════════════════════════════════════════════
INSERT INTO users (id, email, password, name, role, subscription_status, subscription_plan, subscription_expires_at, is_email_verified, is_phone_verified, phone_number) VALUES
('demo-user-001', 'demo@maternalmind.app', '$2b$10$ueoGa7U8m7K5MBZxRtg8m.ufLn9vt4RKJ7.PmNOr2VvEkVrX658rq', 'Dr. Sarah Ahmed', 'student', 'active', 'premium', NOW() + INTERVAL '365 days', true, true, '+923001234567')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- BOOKS (3 main OB-GYN textbooks)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO books (id, title, description, is_published, "order") VALUES
('book-obstetrics', 'Obstetrics', 'Comprehensive study of pregnancy, labor, delivery, and postpartum care. Covers normal and high-risk pregnancy management.', true, 1),
('book-gynecology', 'Gynecology', 'Complete guide to female reproductive health, disorders, surgical procedures, and gynecological oncology.', true, 2),
('book-reproductive', 'Reproductive Endocrinology & Infertility', 'In-depth coverage of reproductive hormones, fertility assessment, assisted reproduction, and endocrine disorders.', true, 3)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- CHAPTERS — Obstetrics (6 chapters)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO chapters (id, book_id, title, description, "order", is_published) VALUES
('ch-obs-1', 'book-obstetrics', 'Normal Pregnancy', 'Physiology of pregnancy, prenatal care, and maternal adaptations.', 1, true),
('ch-obs-2', 'book-obstetrics', 'Labor & Delivery', 'Mechanisms of labor, stages, management, and delivery techniques.', 2, true),
('ch-obs-3', 'book-obstetrics', 'High-Risk Pregnancy', 'Hypertensive disorders, gestational diabetes, and complications.', 3, true),
('ch-obs-4', 'book-obstetrics', 'Antepartum Hemorrhage', 'Placenta previa, abruption, and other causes of bleeding.', 4, true),
('ch-obs-5', 'book-obstetrics', 'Postpartum Care', 'Postpartum hemorrhage, infections, and breastfeeding support.', 5, true),
('ch-obs-6', 'book-obstetrics', 'Fetal Assessment', 'Fetal monitoring, ultrasound, biophysical profile, and non-stress testing.', 6, true)
ON CONFLICT (id) DO NOTHING;

-- CHAPTERS — Gynecology (5 chapters)
INSERT INTO chapters (id, book_id, title, description, "order", is_published) VALUES
('ch-gyn-1', 'book-gynecology', 'Menstrual Disorders', 'Amenorrhea, dysmenorrhea, abnormal uterine bleeding, and PCOS.', 1, true),
('ch-gyn-2', 'book-gynecology', 'Pelvic Infections', 'PID, STIs, vulvovaginitis, and cervicitis management.', 2, true),
('ch-gyn-3', 'book-gynecology', 'Gynecological Tumors', 'Benign and malignant tumors of the uterus, ovaries, and cervix.', 3, true),
('ch-gyn-4', 'book-gynecology', 'Family Planning', 'Contraceptive methods, sterilization, and emergency contraception.', 4, true),
('ch-gyn-5', 'book-gynecology', 'Pelvic Floor Disorders', 'Pelvic organ prolapse, urinary incontinence, and surgical repair.', 5, true)
ON CONFLICT (id) DO NOTHING;

-- CHAPTERS — Reproductive Endocrinology (4 chapters)
INSERT INTO chapters (id, book_id, title, description, "order", is_published) VALUES
('ch-rep-1', 'book-reproductive', 'Reproductive Physiology', 'HPO axis, menstrual cycle, ovulation, and hormonal regulation.', 1, true),
('ch-rep-2', 'book-reproductive', 'Infertility', 'Evaluation, causes, and treatment of male and female infertility.', 2, true),
('ch-rep-3', 'book-reproductive', 'Assisted Reproduction', 'IVF, ICSI, IUI, and other ART techniques.', 3, true),
('ch-rep-4', 'book-reproductive', 'Endocrine Disorders', 'PCOS, thyroid disorders, hyperprolactinemia, and adrenal pathology.', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- TOPICS — Normal Pregnancy (ch-obs-1) — 4 topics
-- ═══════════════════════════════════════════════════════════════
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-1-1', 'ch-obs-1', 'Fertilization & Implantation', 'From oocyte fertilization to blastocyst implantation and early embryonic development.', 1, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-1-2', 'ch-obs-1', 'Maternal Physiological Changes', 'Cardiovascular, respiratory, renal, and hematological adaptations during pregnancy.', 2, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-1-3', 'ch-obs-1', 'Prenatal Care & Screening', 'Antenatal visits schedule, routine labs, genetic screening, and ultrasound timing.', 3, true, 'Dr. Cunningham', 'ACOG Practice Bulletins'),
('t-obs-1-4', 'ch-obs-1', 'Nutrition in Pregnancy', 'Caloric requirements, iron, folate, calcium supplementation, and weight gain guidelines.', 4, true, 'Dr. Gabbe', 'Gabbe Obstetrics, 8th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Labor & Delivery (ch-obs-2) — 4 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-2-1', 'ch-obs-2', 'Stages of Labor', 'First, second, third, and fourth stages. Friedman curve. Active management.', 1, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-2-2', 'ch-obs-2', 'Normal Vaginal Delivery', 'Cardinal movements, episiotomy, assisted delivery, and shoulder dystocia management.', 2, true, 'Dr. Cunningham', 'Williams Obstetrics, 26th Ed.'),
('t-obs-2-3', 'ch-obs-2', 'Cesarean Section', 'Indications, techniques, complications, and VBAC considerations.', 3, true, 'Dr. Williams', 'ACOG Practice Bulletins'),
('t-obs-2-4', 'ch-obs-2', 'Induction of Labor', 'Bishop score, mechanical and pharmacological methods, and contraindications.', 4, true, 'Dr. Gabbe', 'Gabbe Obstetrics, 8th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — High-Risk Pregnancy (ch-obs-3) — 4 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-3-1', 'ch-obs-3', 'Preeclampsia & Eclampsia', 'Pathophysiology, diagnosis, classification, and management of hypertensive disorders.', 1, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-3-2', 'ch-obs-3', 'Gestational Diabetes', 'Screening, diagnosis (OGTT), management, and fetal complications.', 2, true, 'Dr. Gabbe', 'ADA Standards of Care'),
('t-obs-3-3', 'ch-obs-3', 'Multiple Gestation', 'Twins, triplets — chorionicity, risks, and delivery planning.', 3, true, 'Dr. Cunningham', 'Williams Obstetrics, 26th Ed.'),
('t-obs-3-4', 'ch-obs-3', 'Rh Isoimmunization', 'Pathophysiology, Kleihauer-Betke test, RhoGAM prophylaxis, and fetal management.', 4, true, 'Dr. Williams', 'ACOG Practice Bulletins')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Antepartum Hemorrhage (ch-obs-4) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-4-1', 'ch-obs-4', 'Placenta Previa', 'Classification, risk factors, diagnosis, and management.', 1, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-4-2', 'ch-obs-4', 'Placental Abruption', 'Clinical presentation, concealed vs. revealed hemorrhage, DIC risk, and emergency management.', 2, true, 'Dr. Cunningham', 'Williams Obstetrics, 26th Ed.'),
('t-obs-4-3', 'ch-obs-4', 'Vasa Previa & Uterine Rupture', 'Diagnosis, fetal sinusoidal pattern, and surgical management.', 3, true, 'Dr. Gabbe', 'Gabbe Obstetrics, 8th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Postpartum Care (ch-obs-5) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-5-1', 'ch-obs-5', 'Postpartum Hemorrhage', 'Causes (4 Ts), pharmacological and surgical management, uterine tamponade.', 1, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-5-2', 'ch-obs-5', 'Puerperal Infections', 'Endometritis, wound infection, mastitis, and septic pelvic thrombophlebitis.', 2, true, 'Dr. Cunningham', 'Williams Obstetrics, 26th Ed.'),
('t-obs-5-3', 'ch-obs-5', 'Breastfeeding & Lactation', 'Physiology of lactation, common problems, galactagogues, and contraindications.', 3, true, 'Dr. Gabbe', 'WHO Guidelines')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Fetal Assessment (ch-obs-6) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-obs-6-1', 'ch-obs-6', 'Obstetric Ultrasound', 'Dating scan, anomaly scan, growth scans, and Doppler velocimetry.', 1, true, 'Dr. Callen', 'Callen Ultrasonography, 6th Ed.'),
('t-obs-6-2', 'ch-obs-6', 'Fetal Heart Rate Monitoring', 'NST, CST, baseline, variability, accelerations, decelerations, and interpretation.', 2, true, 'Dr. Williams', 'Williams Obstetrics, 26th Ed.'),
('t-obs-6-3', 'ch-obs-6', 'Biophysical Profile & AFI', 'BPP scoring, amniotic fluid index, and modified BPP interpretation.', 3, true, 'Dr. Cunningham', 'ACOG Practice Bulletins')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Menstrual Disorders (ch-gyn-1) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-gyn-1-1', 'ch-gyn-1', 'Abnormal Uterine Bleeding', 'PALM-COEIN classification, evaluation, medical and surgical management.', 1, true, 'Dr. Berek', 'Berek & Novak Gynecology, 16th Ed.'),
('t-gyn-1-2', 'ch-gyn-1', 'Amenorrhea', 'Primary and secondary amenorrhea — workup, differential diagnosis, and treatment.', 2, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-gyn-1-3', 'ch-gyn-1', 'Dysmenorrhea & Endometriosis', 'Primary vs. secondary dysmenorrhea, endometriosis staging, and management.', 3, true, 'Dr. Berek', 'Berek & Novak Gynecology, 16th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Pelvic Infections (ch-gyn-2) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-gyn-2-1', 'ch-gyn-2', 'Pelvic Inflammatory Disease', 'CDC diagnostic criteria, causative organisms, antibiotic regimens, and complications.', 1, true, 'Dr. Berek', 'CDC STI Treatment Guidelines'),
('t-gyn-2-2', 'ch-gyn-2', 'Sexually Transmitted Infections', 'Chlamydia, gonorrhea, syphilis, HPV, HSV — screening and treatment protocols.', 2, true, 'Dr. Berek', 'CDC STI Treatment Guidelines'),
('t-gyn-2-3', 'ch-gyn-2', 'Vulvovaginitis', 'Bacterial vaginosis, candidiasis, trichomoniasis — diagnosis and treatment.', 3, true, 'Dr. Lentz', 'Comprehensive Gynecology, 7th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Gynecological Tumors (ch-gyn-3) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-gyn-3-1', 'ch-gyn-3', 'Uterine Fibroids', 'Classification, symptoms, medical management, myomectomy, and hysterectomy indications.', 1, true, 'Dr. Berek', 'Berek & Novak Gynecology, 16th Ed.'),
('t-gyn-3-2', 'ch-gyn-3', 'Ovarian Tumors', 'Classification (epithelial, germ cell, sex cord), staging, CA-125, and management.', 2, true, 'Dr. Berek', 'Berek & Novak Gynecology, 16th Ed.'),
('t-gyn-3-3', 'ch-gyn-3', 'Cervical Cancer', 'HPV and carcinogenesis, Pap smear screening, colposcopy, staging (FIGO), and treatment.', 3, true, 'Dr. DiSaia', 'Clinical Gynecologic Oncology, 9th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Family Planning (ch-gyn-4) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-gyn-4-1', 'ch-gyn-4', 'Hormonal Contraceptives', 'COCs, POPs, patches, rings, injectables — mechanisms, efficacy, and contraindications.', 1, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-gyn-4-2', 'ch-gyn-4', 'Intrauterine Devices', 'Copper IUD vs. LNG-IUS — insertion, efficacy, complications, and WHO eligibility.', 2, true, 'Dr. Berek', 'WHO MEC for Contraceptive Use'),
('t-gyn-4-3', 'ch-gyn-4', 'Emergency Contraception', 'Levonorgestrel, ulipristal acetate, copper IUD — timing, efficacy, and mechanism.', 3, true, 'Dr. Berek', 'ACOG Practice Bulletin')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Pelvic Floor (ch-gyn-5) — 2 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-gyn-5-1', 'ch-gyn-5', 'Pelvic Organ Prolapse', 'POP-Q staging, types (cystocele, rectocele, uterine), conservative and surgical management.', 1, true, 'Dr. Berek', 'Berek & Novak Gynecology, 16th Ed.'),
('t-gyn-5-2', 'ch-gyn-5', 'Urinary Incontinence', 'Stress vs. urge incontinence — evaluation, urodynamics, and treatment options.', 2, true, 'Dr. Lentz', 'Comprehensive Gynecology, 7th Ed.')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Reproductive Physiology (ch-rep-1) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-rep-1-1', 'ch-rep-1', 'Hypothalamic-Pituitary-Ovarian Axis', 'GnRH pulsatility, FSH/LH regulation, feedback loops, and clinical significance.', 1, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-rep-1-2', 'ch-rep-1', 'The Menstrual Cycle', 'Follicular phase, ovulation, luteal phase — hormonal changes and endometrial response.', 2, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-rep-1-3', 'ch-rep-1', 'Puberty & Menarche', 'Tanner staging, precocious and delayed puberty, and evaluation.', 3, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Infertility (ch-rep-2) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-rep-2-1', 'ch-rep-2', 'Female Infertility Evaluation', 'Ovulatory assessment, HSG, diagnostic laparoscopy, ovarian reserve testing.', 1, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-rep-2-2', 'ch-rep-2', 'Male Factor Infertility', 'Semen analysis, varicocele, hormonal evaluation, and treatment options.', 2, true, 'Dr. Fritz', 'Clinical Reproductive Endocrinology'),
('t-rep-2-3', 'ch-rep-2', 'Ovulation Induction', 'Clomiphene citrate, letrozole, gonadotropins, and OHSS prevention.', 3, true, 'Dr. Speroff', 'ASRM Practice Guidelines')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Assisted Reproduction (ch-rep-3) — 2 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-rep-3-1', 'ch-rep-3', 'In Vitro Fertilization (IVF)', 'Ovarian stimulation, oocyte retrieval, fertilization, embryo transfer, and success rates.', 1, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-rep-3-2', 'ch-rep-3', 'ICSI & Emerging Techniques', 'Intracytoplasmic sperm injection, PGT, embryo cryopreservation, and fertility preservation.', 2, true, 'Dr. Fritz', 'ASRM Practice Guidelines')
ON CONFLICT (id) DO NOTHING;

-- TOPICS — Endocrine Disorders (ch-rep-4) — 3 topics
INSERT INTO topics (id, chapter_id, title, description, "order", is_published, author, source) VALUES
('t-rep-4-1', 'ch-rep-4', 'Polycystic Ovary Syndrome', 'Rotterdam criteria, metabolic implications, hormonal profile, and management.', 1, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology'),
('t-rep-4-2', 'ch-rep-4', 'Thyroid Disorders in Reproduction', 'Hypothyroidism, hyperthyroidism — effects on fertility, pregnancy, and management.', 2, true, 'Dr. Fritz', 'ATA Guidelines'),
('t-rep-4-3', 'ch-rep-4', 'Hyperprolactinemia', 'Causes, evaluation, prolactinoma, dopamine agonists, and fertility restoration.', 3, true, 'Dr. Speroff', 'Speroff Clinical Gynecologic Endocrinology')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- CONTENT BLOCKS — Rich educational content per topic
-- ═══════════════════════════════════════════════════════════════

-- ── t-obs-1-1: Fertilization & Implantation ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-001', 't-obs-1-1', 'heading', 'Overview of Fertilization', 1),
('cb-002', 't-obs-1-1', 'text', 'Fertilization normally occurs in the ampulla of the fallopian tube within 24 hours of ovulation. The sperm must undergo capacitation — a series of biochemical changes that enable it to penetrate the zona pellucida of the oocyte. Once a single sperm penetrates, the cortical reaction prevents polyspermy.', 2),
('cb-003', 't-obs-1-1', 'heading', 'Early Embryonic Development', 3),
('cb-004', 't-obs-1-1', 'text', 'After fertilization, the zygote undergoes rapid mitotic divisions (cleavage) to form a morula by day 3, which then develops into a blastocyst by day 5. The blastocyst consists of the inner cell mass (future embryo) and the trophoblast (future placenta). Implantation begins around day 6-7 post-fertilization.', 4),
('cb-005', 't-obs-1-1', 'note', 'Clinical Pearl: Ectopic implantation occurs in approximately 1-2% of pregnancies. The most common site is the ampulla of the fallopian tube (80%). Risk factors include previous PID, tubal surgery, and IUD use.', 5),
('cb-006', 't-obs-1-1', 'heading', 'Implantation Process', 6),
('cb-007', 't-obs-1-1', 'text', 'Implantation involves three stages: (1) Apposition — the blastocyst loosely attaches to the endometrial surface; (2) Adhesion — firm attachment via integrins and adhesion molecules; (3) Invasion — the trophoblast invades the endometrial stroma, establishing vascular connections. Human chorionic gonadotropin (hCG) is secreted by the syncytiotrophoblast beginning around day 8-10, maintaining the corpus luteum.', 7),
('cb-008', 't-obs-1-1', 'note', 'Remember: The "implantation window" occurs during days 20-24 of a 28-day cycle (6-10 days post-ovulation). Progesterone from the corpus luteum is essential for endometrial receptivity.', 8)
ON CONFLICT (id) DO NOTHING;

-- ── t-obs-1-2: Maternal Physiological Changes ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-009', 't-obs-1-2', 'heading', 'Cardiovascular Changes', 1),
('cb-010', 't-obs-1-2', 'text', 'During pregnancy, cardiac output increases by 30-50%, peaking at 28-32 weeks. Heart rate increases by 15-20 bpm. Blood volume increases by 40-50% (plasma volume > red cell mass), resulting in physiological anemia of pregnancy. Systemic vascular resistance decreases due to progesterone and prostaglandins.', 2),
('cb-011', 't-obs-1-2', 'heading', 'Respiratory Changes', 3),
('cb-012', 't-obs-1-2', 'text', 'Tidal volume increases by 40% while respiratory rate remains unchanged. Functional residual capacity decreases by 20% due to diaphragmatic elevation. Minute ventilation increases, leading to a compensated respiratory alkalosis (PaCO2 ~30 mmHg). The oxygen consumption increases by 20%.', 4),
('cb-013', 't-obs-1-2', 'heading', 'Renal Changes', 5),
('cb-014', 't-obs-1-2', 'text', 'Renal plasma flow increases by 60-80% and GFR increases by 50%, leading to decreased serum creatinine (0.5-0.8 mg/dL) and BUN. Glycosuria may occur due to increased GFR exceeding tubular reabsorption capacity. The ureters dilate (right > left) due to progesterone and mechanical compression.', 6),
('cb-015', 't-obs-1-2', 'note', 'Key Point: A serum creatinine of 1.0 mg/dL, while normal in non-pregnant women, may indicate renal impairment in pregnancy due to the expected physiological decrease.', 7),
('cb-016', 't-obs-1-2', 'heading', 'Hematological Changes', 8),
('cb-017', 't-obs-1-2', 'text', 'Pregnancy is a hypercoagulable state. Fibrinogen increases by 50%. Factors VII, VIII, IX, X, and XII increase. Protein S decreases. These changes increase the risk of venous thromboembolism 4-5 fold. White blood cell count may rise to 12,000-15,000/μL normally.', 9)
ON CONFLICT (id) DO NOTHING;

-- ── t-obs-1-3: Prenatal Care & Screening ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-018', 't-obs-1-3', 'heading', 'Antenatal Visit Schedule', 1),
('cb-019', 't-obs-1-3', 'text', 'Standard prenatal visit schedule: Every 4 weeks until 28 weeks, every 2 weeks from 28-36 weeks, then weekly until delivery. First visit includes complete history, physical exam, BMI, blood pressure, and baseline labs.', 2),
('cb-020', 't-obs-1-3', 'heading', 'First Trimester Screening', 3),
('cb-021', 't-obs-1-3', 'text', 'First trimester combined screening (11-14 weeks): Nuchal translucency (NT) measurement + maternal serum free β-hCG + PAPP-A. Detection rate for Down syndrome: ~85% with 5% false positive rate. Cell-free fetal DNA (NIPT) can be offered from 10 weeks with >99% sensitivity for trisomy 21.', 4),
('cb-022', 't-obs-1-3', 'heading', 'Second Trimester Screening', 5),
('cb-023', 't-obs-1-3', 'text', 'Quad screen (15-20 weeks): AFP, hCG, estriol, inhibin A. Anomaly scan at 18-22 weeks evaluates fetal anatomy. Glucose challenge test (GCT) at 24-28 weeks screens for gestational diabetes. Rh-negative mothers receive RhoGAM at 28 weeks.', 6),
('cb-024', 't-obs-1-3', 'note', 'Mnemonic for elevated AFP: "DOME" — Dating error (most common), Open neural tube defects, Multiple gestation, Encephalocele/abdominal wall defects.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-obs-1-4: Nutrition in Pregnancy ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-025', 't-obs-1-4', 'heading', 'Caloric & Macronutrient Needs', 1),
('cb-026', 't-obs-1-4', 'text', 'Additional caloric requirements: +0 kcal in the first trimester, +340 kcal/day in the second trimester, and +452 kcal/day in the third trimester. Protein requirements increase to 71 g/day. Total recommended weight gain depends on pre-pregnancy BMI: 25-35 lbs (normal BMI), 15-25 lbs (overweight), 11-20 lbs (obese).', 2),
('cb-027', 't-obs-1-4', 'heading', 'Essential Micronutrients', 3),
('cb-028', 't-obs-1-4', 'text', 'Folic acid: 400-800 μg/day (4 mg if history of NTD). Iron: 27 mg/day to support expanded blood volume. Calcium: 1,000 mg/day. Vitamin D: 600 IU/day. Iodine: 220 μg/day for thyroid function. DHA omega-3: 200-300 mg/day for fetal brain development.', 4),
('cb-029', 't-obs-1-4', 'note', 'Warning: Vitamin A supplementation should not exceed 10,000 IU/day due to teratogenic risk (isotretinoin is Category X). Fish with high mercury content (shark, swordfish, king mackerel) should be avoided.', 5)
ON CONFLICT (id) DO NOTHING;

-- ── t-obs-2-1: Stages of Labor ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-030', 't-obs-2-1', 'heading', 'First Stage of Labor', 1),
('cb-031', 't-obs-2-1', 'text', 'The first stage extends from the onset of regular contractions to full cervical dilation (10 cm). It is divided into: (1) Latent phase — slow cervical dilation to 6 cm, may last up to 20 hours in nulliparas; (2) Active phase — more rapid dilation from 6-10 cm, expected cervical change ≥1 cm/hour.', 2),
('cb-032', 't-obs-2-1', 'heading', 'Second Stage of Labor', 3),
('cb-033', 't-obs-2-1', 'text', 'Begins at full dilation and ends with delivery of the baby. Duration: up to 3 hours for nulliparas with epidural, 2 hours without. The cardinal movements of labor occur during this stage: engagement, descent, flexion, internal rotation, extension, external rotation, and expulsion.', 4),
('cb-034', 't-obs-2-1', 'heading', 'Third & Fourth Stages', 5),
('cb-035', 't-obs-2-1', 'text', 'Third stage: From delivery of the baby to delivery of the placenta (usually 5-30 minutes). Active management includes oxytocin, controlled cord traction, and uterine massage. Fourth stage: First 1-2 hours postpartum — critical period for monitoring vital signs and uterine tone to detect postpartum hemorrhage.', 6),
('cb-036', 't-obs-2-1', 'note', 'Clinical Pearl: Signs of placental separation include a gush of blood, lengthening of the umbilical cord, and a globular firm uterine fundus rising in the abdomen. Do NOT apply cord traction before these signs appear.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-obs-3-1: Preeclampsia & Eclampsia ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-037', 't-obs-3-1', 'heading', 'Definition & Classification', 1),
('cb-038', 't-obs-3-1', 'text', 'Preeclampsia is defined as new-onset hypertension (≥140/90 mmHg) after 20 weeks of gestation with proteinuria (≥300 mg/24h) OR end-organ dysfunction. Classification: (1) Preeclampsia without severe features; (2) Preeclampsia with severe features (BP ≥160/110, thrombocytopenia, impaired liver function, renal insufficiency, pulmonary edema, cerebral or visual symptoms).', 2),
('cb-039', 't-obs-3-1', 'heading', 'Pathophysiology', 3),
('cb-040', 't-obs-3-1', 'text', 'The pathophysiology involves abnormal placental development with inadequate trophoblastic invasion of spiral arteries, leading to placental ischemia. This triggers release of anti-angiogenic factors (sFlt-1, soluble endoglin) causing widespread endothelial dysfunction, vasoconstriction, and end-organ damage.', 4),
('cb-041', 't-obs-3-1', 'heading', 'Management', 5),
('cb-042', 't-obs-3-1', 'text', 'Definitive treatment is delivery. For preeclampsia without severe features at ≥37 weeks: deliver. At <37 weeks: expectant management with close monitoring. Severe features: deliver at ≥34 weeks. Magnesium sulfate for seizure prophylaxis (loading 4-6g IV, then 1-2g/hr). Antihypertensives: IV labetalol, IV hydralazine, or oral nifedipine for acute severe hypertension.', 6),
('cb-043', 't-obs-3-1', 'note', 'HELLP Syndrome: Hemolysis (elevated LDH, schistocytes), Elevated Liver enzymes, Low Platelets. A life-threatening variant requiring immediate delivery regardless of gestational age.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-gyn-1-1: Abnormal Uterine Bleeding ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-044', 't-gyn-1-1', 'heading', 'PALM-COEIN Classification', 1),
('cb-045', 't-gyn-1-1', 'text', 'FIGO classification of AUB causes: PALM (structural) — Polyp, Adenomyosis, Leiomyoma, Malignancy/hyperplasia. COEIN (non-structural) — Coagulopathy, Ovulatory dysfunction, Endometrial, Iatrogenic, Not yet classified. This systematic approach ensures thorough evaluation.', 2),
('cb-046', 't-gyn-1-1', 'heading', 'Evaluation', 3),
('cb-047', 't-gyn-1-1', 'text', 'Workup includes: pregnancy test, CBC, coagulation studies, thyroid function, pelvic ultrasound (preferably transvaginal), and endometrial biopsy in women ≥45 years or with risk factors for endometrial hyperplasia/cancer. Saline infusion sonography (SIS) helps evaluate intracavitary lesions.', 4),
('cb-048', 't-gyn-1-1', 'heading', 'Treatment Options', 5),
('cb-049', 't-gyn-1-1', 'text', 'Medical: Combined hormonal contraceptives, progestins (oral or LNG-IUS), tranexamic acid for heavy menstrual bleeding. For acute heavy bleeding: high-dose estrogen followed by taper. Surgical: Endometrial ablation, polypectomy, myomectomy, or hysterectomy based on etiology and patient goals.', 6),
('cb-050', 't-gyn-1-1', 'note', 'Key Point: Endometrial biopsy is mandatory for any woman ≥45 years with AUB or <45 years with risk factors (obesity, chronic anovulation, tamoxifen use, family history of endometrial/colon cancer) to rule out endometrial hyperplasia or cancer.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-gyn-3-3: Cervical Cancer ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-051', 't-gyn-3-3', 'heading', 'HPV & Carcinogenesis', 1),
('cb-052', 't-gyn-3-3', 'text', 'Human papillomavirus (HPV) types 16 and 18 are responsible for approximately 70% of cervical cancers. The E6 protein inactivates p53, and E7 protein inactivates Rb, disrupting cell cycle control. The progression from HPV infection to CIN to invasive cancer typically takes 10-20 years.', 2),
('cb-053', 't-gyn-3-3', 'heading', 'Screening Guidelines', 3),
('cb-054', 't-gyn-3-3', 'text', 'ASCCP/ACS guidelines: Age 21-29: Pap smear every 3 years. Age 30-65: Co-testing (Pap + HPV) every 5 years or Pap alone every 3 years. Primary HPV testing every 5 years is now an accepted option starting at age 25. Screening can stop at age 65 if adequate prior screening was negative.', 4),
('cb-055', 't-gyn-3-3', 'heading', 'FIGO Staging & Treatment', 5),
('cb-056', 't-gyn-3-3', 'text', 'Stage IA1: Cone biopsy or simple hysterectomy. Stage IA2-IB1: Radical hysterectomy with pelvic lymphadenectomy or radiation. Stage IB2-IIA: Chemoradiation (cisplatin-based). Stage IIB-IVA: Primary chemoradiation. Stage IVB: Palliative chemotherapy. Fertility-sparing options (radical trachelectomy) may be considered for early-stage disease in young patients.', 6),
('cb-057', 't-gyn-3-3', 'note', 'Prevention: HPV vaccination (9-valent Gardasil-9) recommended for all individuals ages 9-26 years. Covers types 6, 11, 16, 18, 31, 33, 45, 52, and 58. Can be given as young as age 9 with 2-dose schedule if started before age 15.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-rep-1-2: The Menstrual Cycle ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-058', 't-rep-1-2', 'heading', 'Follicular Phase (Days 1-14)', 1),
('cb-059', 't-rep-1-2', 'text', 'GnRH pulsatile secretion stimulates FSH release. FSH recruits a cohort of antral follicles. By day 5-7, a dominant follicle is selected based on highest FSH receptor density. Rising estradiol from the dominant follicle exerts negative feedback on FSH (causing atresia of non-dominant follicles) and positive feedback at very high levels triggering the LH surge.', 2),
('cb-060', 't-rep-1-2', 'heading', 'Ovulation', 3),
('cb-061', 't-rep-1-2', 'text', 'The LH surge (lasting 36-48 hours) triggers final oocyte maturation, resumption of meiosis I, and follicular rupture approximately 36 hours after LH surge onset. Ovulation occurs at mid-cycle (day 14 in a 28-day cycle). Progesterone levels begin to rise just before ovulation.', 4),
('cb-062', 't-rep-1-2', 'heading', 'Luteal Phase (Days 15-28)', 5),
('cb-063', 't-rep-1-2', 'text', 'The ruptured follicle transforms into the corpus luteum, which secretes progesterone and estradiol. Progesterone transforms the endometrium from proliferative to secretory phase, preparing it for implantation. The luteal phase has a relatively fixed duration of 14 ± 2 days. If no pregnancy occurs, the corpus luteum regresses (luteolysis), progesterone drops, and menstruation begins.', 6),
('cb-064', 't-rep-1-2', 'note', 'Clinical Pearl: Luteal phase deficiency (short luteal phase <11 days or low progesterone) may cause implantation failure and early pregnancy loss. Mid-luteal progesterone >3 ng/mL confirms ovulation.', 7)
ON CONFLICT (id) DO NOTHING;

-- ── t-rep-4-1: PCOS ──
INSERT INTO content_blocks (id, topic_id, type, content, "order") VALUES
('cb-065', 't-rep-4-1', 'heading', 'Rotterdam Diagnostic Criteria', 1),
('cb-066', 't-rep-4-1', 'text', 'PCOS is diagnosed when 2 out of 3 criteria are met: (1) Oligo-ovulation or anovulation (cycles >35 days or <8 cycles/year); (2) Clinical or biochemical hyperandrogenism (hirsutism, acne, elevated free testosterone or DHEA-S); (3) Polycystic ovarian morphology on ultrasound (≥12 follicles 2-9mm per ovary or ovarian volume >10 mL). Other causes of hyperandrogenism must be excluded.', 2),
('cb-067', 't-rep-4-1', 'heading', 'Metabolic Implications', 3),
('cb-068', 't-rep-4-1', 'text', 'PCOS is associated with insulin resistance (50-70% of patients), metabolic syndrome, type 2 diabetes (40% by age 40), dyslipidemia, and cardiovascular disease. The insulin resistance drives ovarian androgen production. Screening includes fasting glucose, insulin, lipid profile, and 2-hour OGTT.', 4),
('cb-069', 't-rep-4-1', 'heading', 'Management', 5),
('cb-070', 't-rep-4-1', 'text', 'Lifestyle: Weight loss of 5-10% can restore ovulation. Medical: COCs for menstrual regulation and anti-androgen effects. Metformin for insulin resistance. Spironolactone for hirsutism. Fertility: Letrozole (first-line for ovulation induction, superior to clomiphene per ASRM). If resistant: gonadotropins or laparoscopic ovarian drilling.', 6),
('cb-071', 't-rep-4-1', 'note', 'Important: Women with PCOS and chronic anovulation have increased risk of endometrial hyperplasia and cancer due to unopposed estrogen. Progestin withdrawal bleed or endometrial biopsy should be performed if prolonged amenorrhea (>3 months).', 7)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- MCQs — 5 per topic (only populated for featured topics) = 60 MCQs
-- ═══════════════════════════════════════════════════════════════

-- ── MCQs: Fertilization & Implantation ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-001', 't-obs-1-1', 'Where does fertilization normally occur?', '["Uterine cavity","Ampulla of the fallopian tube","Isthmus of the fallopian tube","Ovary"]', 'Ampulla of the fallopian tube', 'Fertilization normally occurs in the ampulla (widest part) of the fallopian tube, where the oocyte waits after ovulation.', '{"Uterine cavity":"Implantation occurs here, not fertilization.","Ampulla of the fallopian tube":"Correct — the ampulla is the most common site of fertilization.","Isthmus of the fallopian tube":"The isthmus is narrower and closer to the uterus; fertilization rarely occurs here.","Ovary":"Ovulation releases the oocyte from the ovary, but fertilization occurs in the tube."}', 'easy', '["fertilization","anatomy","fallopian tube"]', true),
('mcq-002', 't-obs-1-1', 'At what day post-fertilization does the blastocyst typically implant?', '["Day 1-2","Day 3-4","Day 6-7","Day 14"]', 'Day 6-7', 'The blastocyst reaches the uterine cavity by day 4-5 and begins implantation around day 6-7 post-fertilization.', '{"Day 1-2":"At this stage, only early cleavage divisions have occurred.","Day 3-4":"The morula stage — not yet ready for implantation.","Day 6-7":"Correct — implantation begins at the blastocyst stage around day 6-7.","Day 14":"This would be around the time of the missed period, well after implantation."}', 'easy', '["implantation","embryology"]', true),
('mcq-003', 't-obs-1-1', 'What is the function of the cortical reaction after sperm entry?', '["Triggers embryonic gene activation","Facilitates sperm capacitation","Prevents polyspermy","Initiates implantation"]', 'Prevents polyspermy', 'The cortical reaction involves release of cortical granules that modify the zona pellucida, creating a block to additional sperm entry (polyspermy prevention).', '{"Triggers embryonic gene activation":"Embryonic gene activation occurs at the 4-8 cell stage.","Facilitates sperm capacitation":"Capacitation occurs before fertilization, in the female reproductive tract.","Prevents polyspermy":"Correct — cortical granules harden the zona pellucida to prevent additional sperm entry.","Initiates implantation":"Implantation occurs days later, mediated by trophoblast interactions with endometrium."}', 'medium', '["fertilization","polyspermy","zona pellucida"]', true),
('mcq-004', 't-obs-1-1', 'Which hormone maintains the corpus luteum in early pregnancy?', '["FSH","LH","Estrogen","hCG"]', 'hCG', 'Human chorionic gonadotropin (hCG), produced by the syncytiotrophoblast, maintains the corpus luteum and its progesterone production until the placenta takes over at 8-10 weeks.', '{"FSH":"FSH is involved in follicular recruitment, not corpus luteum maintenance in pregnancy.","LH":"LH maintains the corpus luteum in the non-pregnant luteal phase, but hCG takes over in pregnancy.","Estrogen":"Estrogen is produced by the corpus luteum but does not maintain it.","hCG":"Correct — hCG from the trophoblast rescues the corpus luteum from luteolysis."}', 'easy', '["hCG","corpus luteum","early pregnancy"]', true),
('mcq-005', 't-obs-1-1', 'The most common site of ectopic pregnancy is:', '["Ovary","Cervix","Ampulla of the fallopian tube","Peritoneal cavity"]', 'Ampulla of the fallopian tube', 'Approximately 80% of ectopic pregnancies occur in the ampulla of the fallopian tube, the same region where fertilization occurs.', '{"Ovary":"Ovarian ectopic pregnancy accounts for only 1-3% of ectopics.","Cervix":"Cervical ectopic is rare (<1%).","Ampulla of the fallopian tube":"Correct — 80% of ectopic pregnancies occur here.","Peritoneal cavity":"Abdominal pregnancy is extremely rare."}', 'easy', '["ectopic pregnancy","fallopian tube"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Maternal Physiological Changes ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-006', 't-obs-1-2', 'By how much does cardiac output increase during pregnancy?', '["10-15%","30-50%","60-80%","100%"]', '30-50%', 'Cardiac output increases by 30-50% during pregnancy, peaking at 28-32 weeks, due to increased stroke volume and heart rate.', '{"10-15%":"This underestimates the cardiovascular changes of pregnancy.","30-50%":"Correct — this increase is due to both increased stroke volume and heart rate.","60-80%":"This is the increase in renal plasma flow, not cardiac output.","100%":"Cardiac output does not double in pregnancy."}', 'medium', '["cardiac output","pregnancy physiology"]', true),
('mcq-007', 't-obs-1-2', 'What is the normal PaCO2 during pregnancy?', '["40 mmHg","35 mmHg","30 mmHg","25 mmHg"]', '30 mmHg', 'Pregnancy causes a compensated respiratory alkalosis with PaCO2 ~30 mmHg due to progesterone-stimulated hyperventilation (increased tidal volume).', '{"40 mmHg":"This is the normal non-pregnant PaCO2.","35 mmHg":"Close but still higher than the typical pregnancy value.","30 mmHg":"Correct — chronic compensated respiratory alkalosis of pregnancy.","25 mmHg":"This would indicate excessive hyperventilation."}', 'medium', '["respiratory","pregnancy physiology","blood gases"]', true),
('mcq-008', 't-obs-1-2', 'A serum creatinine of 1.0 mg/dL in a pregnant woman suggests:', '["Normal renal function","Renal impairment","Dehydration","Laboratory error"]', 'Renal impairment', 'Due to the 50% increase in GFR during pregnancy, normal serum creatinine drops to 0.5-0.8 mg/dL. A value of 1.0 mg/dL, while normal in non-pregnant women, suggests renal impairment in pregnancy.', '{"Normal renal function":"This would be normal in a non-pregnant patient but not during pregnancy.","Renal impairment":"Correct — normal pregnancy creatinine is 0.5-0.8 mg/dL due to increased GFR.","Dehydration":"Dehydration would elevate creatinine, but the key point is that 1.0 is abnormal in pregnancy.","Laboratory error":"This is a plausible value that should prompt clinical evaluation, not dismissal."}', 'hard', '["renal","creatinine","pregnancy physiology"]', true),
('mcq-009', 't-obs-1-2', 'Which of the following is NOT a normal hematological change in pregnancy?', '["Increased fibrinogen","Decreased protein S","Increased protein C","Increased WBC count"]', 'Increased protein C', 'Protein C levels remain relatively unchanged in pregnancy. Protein S decreases, fibrinogen increases, and there is a physiological leukocytosis — all contributing to the hypercoagulable state.', '{"Increased fibrinogen":"Fibrinogen increases by 50% — this is a normal pregnancy change.","Decreased protein S":"Protein S decreases in pregnancy, contributing to hypercoagulability.","Increased protein C":"Correct — Protein C does NOT typically increase; it remains stable or slightly decreases.","Increased WBC count":"Leukocytosis up to 15,000/μL is normal in pregnancy."}', 'hard', '["hematology","hypercoagulability","pregnancy"]', true),
('mcq-010', 't-obs-1-2', 'What causes the physiological anemia of pregnancy?', '["Iron deficiency","Hemodilution","Folic acid deficiency","Hemolysis"]', 'Hemodilution', 'Plasma volume increases by 50% while red cell mass increases by only 25-30%, resulting in a dilutional decrease in hemoglobin concentration (physiological anemia).', '{"Iron deficiency":"While iron deficiency can occur, physiological anemia is due to hemodilution, not deficiency.","Hemodilution":"Correct — disproportionate increase in plasma volume vs. red cell mass.","Folic acid deficiency":"Folate deficiency causes megaloblastic anemia, a pathological condition.","Hemolysis":"Hemolysis is pathological (seen in HELLP syndrome), not physiological."}', 'medium', '["anemia","hemodilution","pregnancy"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Preeclampsia & Eclampsia ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-011', 't-obs-3-1', 'Which of the following defines severe preeclampsia?', '["BP ≥140/90 with proteinuria","BP ≥160/110 or end-organ dysfunction","BP ≥180/120","Proteinuria >500 mg/24h alone"]', 'BP ≥160/110 or end-organ dysfunction', 'Severe features include: BP ≥160/110 on two occasions, thrombocytopenia (<100,000), elevated liver enzymes (2× normal), renal insufficiency (Cr >1.1), pulmonary edema, or cerebral/visual disturbances.', '{"BP ≥140/90 with proteinuria":"This defines preeclampsia WITHOUT severe features.","BP ≥160/110 or end-organ dysfunction":"Correct — severe features are defined by significantly elevated BP or end-organ damage.","BP ≥180/120":"This would be hypertensive emergency, but the threshold for severe preeclampsia is 160/110.","Proteinuria >500 mg/24h alone":"The degree of proteinuria no longer determines severity in current guidelines."}', 'medium', '["preeclampsia","hypertension","pregnancy"]', true),
('mcq-012', 't-obs-3-1', 'The definitive treatment for preeclampsia is:', '["Magnesium sulfate","Antihypertensive therapy","Delivery","Bed rest"]', 'Delivery', 'The only definitive treatment for preeclampsia is delivery. Magnesium sulfate prevents seizures, and antihypertensives control acute severe hypertension, but they do not cure the disease.', '{"Magnesium sulfate":"MgSO4 is for seizure prophylaxis/treatment, not definitive management.","Antihypertensive therapy":"Antihypertensives control BP but do not resolve the underlying disease.","Delivery":"Correct — delivery is the only definitive treatment as the placenta drives the disease process.","Bed rest":"Bed rest has not been shown to prevent progression or improve outcomes."}', 'easy', '["preeclampsia","treatment","delivery"]', true),
('mcq-013', 't-obs-3-1', 'HELLP syndrome includes all EXCEPT:', '["Hemolysis","Elevated liver enzymes","Leukocytosis","Low platelets"]', 'Leukocytosis', 'HELLP = Hemolysis (elevated LDH, schistocytes), Elevated Liver enzymes, Low Platelets. Leukocytosis is not part of the HELLP triad.', '{"Hemolysis":"H in HELLP — characterized by schistocytes and elevated LDH.","Elevated liver enzymes":"EL in HELLP — AST/ALT elevation indicates hepatic involvement.","Leukocytosis":"Correct — leukocytosis is NOT part of HELLP syndrome.","Low platelets":"LP in HELLP — thrombocytopenia <100,000/μL."}', 'easy', '["HELLP","preeclampsia","hematology"]', true),
('mcq-014', 't-obs-3-1', 'At what gestational age should you deliver a patient with preeclampsia with severe features?', '["≥28 weeks","≥32 weeks","≥34 weeks","≥37 weeks"]', '≥34 weeks', 'Current ACOG guidelines recommend delivery at ≥34 weeks for preeclampsia with severe features. Before 34 weeks, expectant management may be attempted in a facility with maternal-fetal medicine capability if stable.', '{"≥28 weeks":"Delivery at 28 weeks would expose the neonate to significant prematurity risks.","≥32 weeks":"32 weeks was a prior threshold; current guidelines use 34 weeks.","≥34 weeks":"Correct — ACOG recommends delivery at ≥34 weeks for severe preeclampsia.","≥37 weeks":"37 weeks is the threshold for preeclampsia WITHOUT severe features."}', 'hard', '["preeclampsia","delivery timing","ACOG"]', true),
('mcq-015', 't-obs-3-1', 'The loading dose of magnesium sulfate for eclampsia prophylaxis is:', '["2 g IV","4-6 g IV","10 g IV","1 g IM"]', '4-6 g IV', 'The standard loading dose is 4-6 g IV over 15-20 minutes, followed by a maintenance infusion of 1-2 g/hour. Monitor for magnesium toxicity: loss of deep tendon reflexes, respiratory depression.', '{"2 g IV":"This dose is subtherapeutic for eclampsia prophylaxis.","4-6 g IV":"Correct — standard loading dose followed by 1-2 g/hr maintenance.","10 g IV":"This exceeds the recommended dose and risks toxicity.","1 g IM":"IM administration is an alternative but the loading dose is 10g IM (5g each buttock), not 1g."}', 'medium', '["magnesium sulfate","eclampsia","pharmacology"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Stages of Labor ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-016', 't-obs-2-1', 'The active phase of the first stage of labor begins at:', '["2 cm dilation","4 cm dilation","6 cm dilation","8 cm dilation"]', '6 cm dilation', 'Current evidence (Zhang et al., supported by ACOG/SMFM) defines active labor as beginning at 6 cm dilation, replacing the older Friedman definition of 4 cm.', '{"2 cm dilation":"This is early latent phase.","4 cm dilation":"This was the traditional Friedman curve threshold but has been updated.","6 cm dilation":"Correct — the contemporary definition based on the Consortium on Safe Labor data.","8 cm dilation":"8 cm is in the transition phase, well into active labor."}', 'medium', '["labor stages","active phase","cervical dilation"]', true),
('mcq-017', 't-obs-2-1', 'Which is NOT a cardinal movement of labor?', '["Descent","Internal rotation","Cervical dilation","Extension"]', 'Cervical dilation', 'The 7 cardinal movements are: engagement, descent, flexion, internal rotation, extension, external rotation (restitution), and expulsion. Cervical dilation is part of the first stage but not a cardinal movement of the fetal mechanism.', '{"Descent":"Descent is a cardinal movement occurring throughout labor.","Internal rotation":"Internal rotation aligns the fetal head with the AP diameter of the pelvis.","Cervical dilation":"Correct — cervical dilation is NOT a cardinal movement; it is a measure of first-stage progress.","Extension":"Extension occurs as the fetal head passes under the symphysis pubis."}', 'easy', '["cardinal movements","labor mechanism"]', true),
('mcq-018', 't-obs-2-1', 'Signs of placental separation include all EXCEPT:', '["Gush of blood","Cord lengthening","Uterine relaxation","Globular uterine shape"]', 'Uterine relaxation', 'Signs of placental separation: gush of blood, lengthening of umbilical cord, and the uterus becomes firm and globular (contracts, does not relax). Uterine relaxation would indicate a problem, not normal separation.', '{"Gush of blood":"A gush of blood accompanies placental separation from the uterine wall.","Cord lengthening":"As the placenta descends, the visible cord lengthens.","Uterine relaxation":"Correct — the uterus should become firm and globular, NOT relax.","Globular uterine shape":"The uterus changes from a discoid to globular shape as the placenta separates."}', 'medium', '["placenta","third stage","labor"]', true),
('mcq-019', 't-obs-2-1', 'The maximum duration of the second stage in a nullipara with epidural is:', '["1 hour","2 hours","3 hours","4 hours"]', '3 hours', 'ACOG allows up to 3 hours for the second stage in nulliparas with epidural anesthesia (2 hours without epidural). For multiparas: 2 hours with epidural, 1 hour without.', '{"1 hour":"This is the limit for multiparas without epidural.","2 hours":"This is the limit for nulliparas without epidural.","3 hours":"Correct — nullipara with epidural may have up to 3 hours.","4 hours":"This exceeds the recommended maximum even with epidural."}', 'medium', '["second stage","labor duration","epidural"]', true),
('mcq-020', 't-obs-2-1', 'Active management of the third stage includes:', '["Expectant waiting for 60 minutes","Oxytocin, cord traction, and uterine massage","Immediate manual removal","IV antibiotics"]', 'Oxytocin, cord traction, and uterine massage', 'Active management of the third stage (AMTSL) reduces PPH risk by 60% and includes: prophylactic uterotonic (oxytocin 10 IU IM), controlled cord traction, and uterine massage after placental delivery.', '{"Expectant waiting for 60 minutes":"Expectant management is an alternative but not active management.","Oxytocin, cord traction, and uterine massage":"Correct — the three components of AMTSL.","Immediate manual removal":"Manual removal is reserved for retained placenta (>30 min).","IV antibiotics":"Antibiotics are not part of routine third stage management."}', 'medium', '["AMTSL","third stage","PPH prevention"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: AUB ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-021', 't-gyn-1-1', 'The "P" in PALM-COEIN stands for:', '["Polyp","Pregnancy","Prolapse","Progesterone"]', 'Polyp', 'PALM-COEIN: P = Polyp, A = Adenomyosis, L = Leiomyoma, M = Malignancy. These are the structural causes of AUB.', '{"Polyp":"Correct — endometrial polyps are a common structural cause of AUB.","Pregnancy":"Pregnancy should be ruled out but is not part of the PALM-COEIN system.","Prolapse":"Prolapse is not included in the AUB classification.","Progesterone":"Progesterone is a treatment, not a classification category."}', 'easy', '["PALM-COEIN","AUB","classification"]', true),
('mcq-022', 't-gyn-1-1', 'Endometrial biopsy is mandatory in AUB for women aged:', '["≥35 years","≥40 years","≥45 years","≥50 years"]', '≥45 years', 'ACOG recommends endometrial biopsy for all women ≥45 years with AUB to rule out endometrial hyperplasia or carcinoma. Women <45 with risk factors also warrant biopsy.', '{"≥35 years":"This threshold is too low for routine biopsy in all AUB patients.","≥40 years":"Some sources use this, but ACOG standard is ≥45 or with risk factors.","≥45 years":"Correct — ACOG recommendation for routine endometrial sampling.","≥50 years":"Waiting until 50 would miss cases of endometrial pathology."}', 'medium', '["endometrial biopsy","AUB","screening"]', true),
('mcq-023', 't-gyn-1-1', 'First-line medical treatment for heavy menstrual bleeding is:', '["Hysterectomy","LNG-IUS (Mirena)","Danazol","GnRH agonists"]', 'LNG-IUS (Mirena)', 'The levonorgestrel intrauterine system (LNG-IUS/Mirena) is the most effective medical treatment for heavy menstrual bleeding, reducing blood loss by up to 97%. It is first-line per NICE and ACOG guidelines.', '{"Hysterectomy":"Hysterectomy is definitive but reserved for failed medical management or other indications.","LNG-IUS (Mirena)":"Correct — most effective first-line medical treatment for HMB.","Danazol":"Danazol is effective but has significant androgenic side effects; rarely used first-line.","GnRH agonists":"GnRH agonists cause hypoestrogenic side effects and are used short-term or pre-surgically."}', 'medium', '["HMB","LNG-IUS","treatment"]', true),
('mcq-024', 't-gyn-1-1', 'Which is a non-structural cause of AUB?', '["Leiomyoma","Polyp","Coagulopathy","Adenomyosis"]', 'Coagulopathy', 'COEIN represents non-structural causes: Coagulopathy, Ovulatory dysfunction, Endometrial, Iatrogenic, Not yet classified. PALM represents structural causes.', '{"Leiomyoma":"L in PALM — a structural cause.","Polyp":"P in PALM — a structural cause.","Coagulopathy":"Correct — C in COEIN, a non-structural cause (e.g., von Willebrand disease).","Adenomyosis":"A in PALM — a structural cause."}', 'easy', '["PALM-COEIN","AUB","coagulopathy"]', true),
('mcq-025', 't-gyn-1-1', 'Tranexamic acid works by:', '["Inhibiting prostaglandins","Inhibiting fibrinolysis","Blocking estrogen","Inducing ovulation"]', 'Inhibiting fibrinolysis', 'Tranexamic acid is an antifibrinolytic that blocks the conversion of plasminogen to plasmin, stabilizing blood clots and reducing menstrual blood loss by 40-50%.', '{"Inhibiting prostaglandins":"NSAIDs inhibit prostaglandins; tranexamic acid does not.","Inhibiting fibrinolysis":"Correct — antifibrinolytic mechanism stabilizes clots.","Blocking estrogen":"This describes SERMs, not tranexamic acid.","Inducing ovulation":"Ovulation induction agents include clomiphene and letrozole."}', 'medium', '["tranexamic acid","antifibrinolytic","HMB"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Cervical Cancer ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-026', 't-gyn-3-3', 'Which HPV types cause 70% of cervical cancers?', '["Types 6 and 11","Types 16 and 18","Types 31 and 33","Types 52 and 58"]', 'Types 16 and 18', 'HPV types 16 and 18 are high-risk oncogenic types responsible for approximately 70% of all cervical cancers. Types 6 and 11 cause genital warts (low-risk).', '{"Types 6 and 11":"These are low-risk types causing genital warts (condylomata acuminata), not cervical cancer.","Types 16 and 18":"Correct — the two most important oncogenic HPV types.","Types 31 and 33":"These are high-risk types but cause a smaller percentage of cervical cancers.","Types 52 and 58":"Also high-risk but less commonly implicated than 16/18."}', 'easy', '["HPV","cervical cancer","oncogenesis"]', true),
('mcq-027', 't-gyn-3-3', 'Cervical cancer screening begins at age:', '["18","21","25","30"]', '21', 'ACOG/ASCCP guidelines recommend starting cervical cancer screening at age 21 with Pap smear, regardless of age of sexual debut. Starting earlier may lead to unnecessary procedures.', '{"18":"Screening at 18 is no longer recommended regardless of sexual activity status.","21":"Correct — screening starts at age 21 with Pap smear every 3 years.","25":"25 is when primary HPV testing alone may be used per newer ACS guidelines.","30":"At 30, co-testing (Pap + HPV) can be started every 5 years."}', 'easy', '["screening","Pap smear","cervical cancer"]', true),
('mcq-028', 't-gyn-3-3', 'The E6 protein of HPV inactivates which tumor suppressor?', '["Rb","p53","APC","BRCA1"]', 'p53', 'HPV E6 protein binds to and promotes degradation of p53 via ubiquitin pathway. HPV E7 protein inactivates Rb. Together, these disable cell cycle checkpoints allowing uncontrolled proliferation.', '{"Rb":"Rb is inactivated by E7 protein, not E6.","p53":"Correct — E6 targets p53 for degradation via the ubiquitin-proteasome pathway.","APC":"APC mutations are associated with familial adenomatous polyposis (colon cancer).","BRCA1":"BRCA1 mutations are associated with breast and ovarian cancer."}', 'hard', '["HPV","E6","p53","molecular biology"]', true),
('mcq-029', 't-gyn-3-3', 'Treatment for stage IB2-IIA cervical cancer is:', '["Cone biopsy","Simple hysterectomy","Chemoradiation","Radical trachelectomy"]', 'Chemoradiation', 'Stage IB2-IIA (bulky tumors >4 cm) are treated with concurrent chemoradiation (cisplatin-based chemotherapy with external beam radiation + brachytherapy). This has shown superior outcomes compared to radiation alone.', '{"Cone biopsy":"Cone biopsy is adequate only for stage IA1 without LVSI.","Simple hysterectomy":"Simple hysterectomy does not remove parametrial tissue needed for adequate margins.","Chemoradiation":"Correct — concurrent cisplatin-based chemoradiation for IB2-IIA.","Radical trachelectomy":"Trachelectomy is fertility-sparing for early-stage (≤IB1, <2cm) disease only."}', 'hard', '["cervical cancer","chemoradiation","staging"]', true),
('mcq-030', 't-gyn-3-3', 'HPV vaccine Gardasil-9 covers how many HPV types?', '["2","4","7","9"]', '9', 'Gardasil-9 is the 9-valent HPV vaccine covering types 6, 11 (warts), 16, 18, 31, 33, 45, 52, and 58 (cancer-causing). It prevents ~90% of cervical cancers.', '{"2":"The bivalent vaccine (Cervarix) covers 2 types (16, 18).","4":"The original Gardasil (quadrivalent) covered 4 types (6, 11, 16, 18).","7":"No commercial HPV vaccine covers exactly 7 types.","9":"Correct — Gardasil-9 covers 9 HPV types."}', 'easy', '["HPV vaccine","Gardasil-9","prevention"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: The Menstrual Cycle ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-031', 't-rep-1-2', 'The LH surge triggers ovulation approximately how many hours later?', '["12 hours","24 hours","36 hours","48 hours"]', '36 hours', 'Ovulation occurs approximately 36 hours after the onset of the LH surge (or 10-12 hours after the LH peak). This timing is used clinically for IUI and timed intercourse.', '{"12 hours":"This is too early; the LH surge just began.","24 hours":"Ovulation may not have occurred yet at 24 hours.","36 hours":"Correct — ovulation occurs ~36 hours after LH surge onset.","48 hours":"This is after ovulation has typically occurred."}', 'medium', '["LH surge","ovulation","reproductive physiology"]', true),
('mcq-032', 't-rep-1-2', 'The luteal phase has a relatively fixed duration of:', '["7 ± 2 days","10 ± 2 days","14 ± 2 days","21 ± 2 days"]', '14 ± 2 days', 'The luteal phase is remarkably constant at 14 ± 2 days in ovulatory cycles. Cycle length variation is primarily due to variation in the follicular phase duration.', '{"7 ± 2 days":"This is too short; would indicate luteal phase deficiency.","10 ± 2 days":"This could indicate mild luteal insufficiency.","14 ± 2 days":"Correct — the luteal phase is relatively fixed at 14 ± 2 days.","21 ± 2 days":"This would be abnormally long for a luteal phase."}', 'easy', '["luteal phase","menstrual cycle"]', true),
('mcq-033', 't-rep-1-2', 'What triggers the LH surge?', '["Falling estrogen levels","Sustained high estrogen levels","Rising progesterone","Increasing FSH"]', 'Sustained high estrogen levels', 'When estradiol from the dominant follicle exceeds 200 pg/mL for approximately 50 hours, it switches from negative to positive feedback on the hypothalamus/pituitary, triggering the GnRH and LH surge.', '{"Falling estrogen levels":"Falling estrogen occurs during menstruation, not before ovulation.","Sustained high estrogen levels":"Correct — positive feedback requires estradiol >200 pg/mL for ~50 hours.","Rising progesterone":"Progesterone rises after the LH surge, not before.","Increasing FSH":"FSH decreases in the late follicular phase due to negative feedback from estrogen."}', 'hard', '["LH surge","estrogen","positive feedback"]', true),
('mcq-034', 't-rep-1-2', 'A mid-luteal progesterone level >3 ng/mL confirms:', '["Pregnancy","Ovulation","Menopause","Follicular development"]', 'Ovulation', 'A serum progesterone level >3 ng/mL in the mid-luteal phase (day 21 of a 28-day cycle) confirms that ovulation has occurred. Levels <3 suggest anovulation. Levels >10 suggest adequate luteal function.', '{"Pregnancy":"Pregnancy is confirmed by hCG, not progesterone alone.","Ovulation":"Correct — progesterone >3 ng/mL at mid-luteal phase confirms ovulation occurred.","Menopause":"Menopause is diagnosed by elevated FSH and low estradiol.","Follicular development":"Follicular development is monitored by ultrasound and estradiol levels."}', 'medium', '["progesterone","ovulation confirmation","luteal phase"]', true),
('mcq-035', 't-rep-1-2', 'During the follicular phase, FSH stimulates:', '["Corpus luteum formation","Antral follicle recruitment","Endometrial shedding","Progesterone secretion"]', 'Antral follicle recruitment', 'FSH rises in the early follicular phase and recruits a cohort of antral follicles. Each follicle''s granulosa cells have FSH receptors and produce estradiol in response to FSH stimulation.', '{"Corpus luteum formation":"The corpus luteum forms after ovulation from the ruptured follicle.","Antral follicle recruitment":"Correct — FSH recruits a cohort of antral follicles in the early follicular phase.","Endometrial shedding":"Menstruation is triggered by progesterone withdrawal, not FSH.","Progesterone secretion":"Progesterone is primarily a luteal phase hormone."}', 'easy', '["FSH","follicular phase","folliculogenesis"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: PCOS ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-036', 't-rep-4-1', 'How many Rotterdam criteria are needed for PCOS diagnosis?', '["1 of 3","2 of 3","All 3","1 of 2"]', '2 of 3', 'PCOS is diagnosed when at least 2 of the 3 Rotterdam criteria are met: (1) oligo/anovulation, (2) hyperandrogenism (clinical or biochemical), (3) polycystic ovaries on ultrasound, after excluding other causes.', '{"1 of 3":"One criterion alone is insufficient for diagnosis.","2 of 3":"Correct — at least 2 of 3 Rotterdam criteria must be met.","All 3":"All three are not required; 2 of 3 is sufficient.","1 of 2":"This is not the correct framework for PCOS diagnosis."}', 'easy', '["PCOS","Rotterdam criteria","diagnosis"]', true),
('mcq-037', 't-rep-4-1', 'First-line ovulation induction agent for PCOS is:', '["Clomiphene citrate","Letrozole","Gonadotropins","Metformin"]', 'Letrozole', 'Based on the ASRM/ESHRE 2023 guidelines and the landmark NICHD trial, letrozole is now considered first-line for ovulation induction in PCOS, with higher live birth rates than clomiphene.', '{"Clomiphene citrate":"Previously first-line but letrozole has shown superior outcomes in PCOS patients.","Letrozole":"Correct — letrozole is now first-line per ASRM guidelines due to higher ovulation and live birth rates.","Gonadotropins":"Gonadotropins are second-line due to higher risk of multiple pregnancy and OHSS.","Metformin":"Metformin improves insulin sensitivity but is less effective than letrozole for ovulation induction."}', 'medium', '["PCOS","ovulation induction","letrozole"]', true),
('mcq-038', 't-rep-4-1', 'What percentage of PCOS patients have insulin resistance?', '["10-20%","30-40%","50-70%","90-100%"]', '50-70%', 'Approximately 50-70% of women with PCOS have insulin resistance, regardless of BMI. Insulin resistance drives ovarian androgen excess by stimulating theca cell androgen production and reducing hepatic SHBG.', '{"10-20%":"This significantly underestimates the prevalence of IR in PCOS.","30-40%":"This is lower than most studies report.","50-70%":"Correct — insulin resistance affects the majority of PCOS patients.","90-100%":"While common, not all PCOS patients have measurable insulin resistance."}', 'medium', '["PCOS","insulin resistance","metabolic"]', true),
('mcq-039', 't-rep-4-1', 'Weight loss of what percentage can restore ovulation in PCOS?', '["1-2%","5-10%","15-20%","25-30%"]', '5-10%', 'Even modest weight loss of 5-10% of body weight can restore regular ovulatory cycles in overweight/obese PCOS patients by improving insulin sensitivity and reducing androgen levels.', '{"1-2%":"This is too small to have significant metabolic impact.","5-10%":"Correct — modest weight loss of 5-10% can significantly improve ovulatory function.","15-20%":"While more weight loss is beneficial, even 5-10% is effective.","25-30%":"Excessive weight loss targets may be unsustainable and unnecessary."}', 'easy', '["PCOS","weight loss","lifestyle"]', true),
('mcq-040', 't-rep-4-1', 'Unopposed estrogen in PCOS increases the risk of:', '["Cervical cancer","Endometrial hyperplasia","Ovarian cancer","Breast cancer"]', 'Endometrial hyperplasia', 'Chronic anovulation in PCOS leads to continuous estrogen stimulation of the endometrium without the opposing effect of progesterone, increasing the risk of endometrial hyperplasia and carcinoma.', '{"Cervical cancer":"Cervical cancer is primarily caused by HPV, not hormonal factors.","Endometrial hyperplasia":"Correct — unopposed estrogen from chronic anovulation directly increases endometrial cancer risk.","Ovarian cancer":"While PCOS may slightly increase ovarian cancer risk, the primary concern is endometrial.","Breast cancer":"Estrogen exposure increases breast cancer risk but the direct concern in PCOS is endometrial pathology."}', 'medium', '["PCOS","endometrial hyperplasia","unopposed estrogen"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Postpartum Hemorrhage ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-041', 't-obs-5-1', 'The most common cause of PPH is:', '["Trauma","Tissue retention","Uterine atony","Thrombin disorders"]', 'Uterine atony', 'Uterine atony accounts for 70-80% of all postpartum hemorrhage cases. The "4 Ts" mnemonic: Tone (atony), Trauma, Tissue (retained placenta), Thrombin (coagulopathy).', '{"Trauma":"Trauma (lacerations, hematomas) accounts for ~20% of PPH.","Tissue retention":"Retained placental tissue causes ~10% of PPH.","Uterine atony":"Correct — uterine atony is the cause in 70-80% of PPH cases.","Thrombin disorders":"Coagulopathies are the least common cause (<5%)."}', 'easy', '["PPH","uterine atony","4 Ts"]', true),
('mcq-042', 't-obs-5-1', 'PPH is defined as blood loss exceeding:', '["200 mL","500 mL","1000 mL","1500 mL"]', '1000 mL', 'The revised (ACOG 2017) definition of PPH is cumulative blood loss ≥1000 mL or blood loss accompanied by signs/symptoms of hypovolemia within 24 hours of delivery, regardless of delivery route.', '{"200 mL":"This is within normal blood loss for vaginal delivery.","500 mL":"The traditional definition used 500 mL for vaginal delivery, but this has been updated.","1000 mL":"Correct — current ACOG definition uses ≥1000 mL regardless of delivery route.","1500 mL":"This threshold is too high and would miss cases of significant PPH."}', 'medium', '["PPH","definition","blood loss"]', true),
('mcq-043', 't-obs-5-1', 'First-line uterotonic for PPH is:', '["Ergometrine","Carboprost","Oxytocin","Misoprostol"]', 'Oxytocin', 'Oxytocin is the first-line uterotonic for both prevention and treatment of PPH. It causes rhythmic uterine contractions. Given as 10-40 IU IV infusion. Second-line agents include methylergonovine, carboprost (15-methyl PGF2α), and misoprostol.', '{"Ergometrine":"Ergometrine/methylergonovine is second-line; contraindicated in hypertension.","Carboprost":"Carboprost (Hemabate) is second-line; contraindicated in asthma.","Oxytocin":"Correct — oxytocin is the first-line uterotonic for PPH.","Misoprostol":"Misoprostol is an alternative when other agents are unavailable."}', 'easy', '["PPH","oxytocin","uterotonics"]', true),
('mcq-044', 't-obs-5-1', 'Carboprost (Hemabate) is contraindicated in:', '["Hypertension","Asthma","Liver disease","Diabetes"]', 'Asthma', 'Carboprost (15-methyl PGF2α) is a potent uterotonic but is contraindicated in asthma as it causes bronchospasm. It can also cause diarrhea, fever, and hypertension.', '{"Hypertension":"Methylergonovine is contraindicated in hypertension, not carboprost.","Asthma":"Correct — carboprost causes bronchospasm and is contraindicated in asthma.","Liver disease":"Liver disease is not a primary contraindication for carboprost.","Diabetes":"Diabetes is not a contraindication for carboprost."}', 'medium', '["carboprost","PPH","contraindication","asthma"]', true),
('mcq-045', 't-obs-5-1', 'Bakri balloon tamponade is used for:', '["Cervical laceration","Uterine atony refractory to medications","Retained placenta","Coagulopathy"]', 'Uterine atony refractory to medications', 'Intrauterine balloon tamponade (Bakri balloon) is used when medical management fails to control PPH from uterine atony. It is filled with saline (300-500 mL) and applies pressure to the uterine cavity. Success rate is approximately 85%.', '{"Cervical laceration":"Cervical lacerations require surgical repair, not balloon tamponade.","Uterine atony refractory to medications":"Correct — balloon tamponade is used when uterotonics fail.","Retained placenta":"Retained placenta requires manual removal or curettage.","Coagulopathy":"Coagulopathy requires blood products and correction of underlying cause."}', 'hard', '["Bakri balloon","PPH","tamponade"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Placenta Previa ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-046', 't-obs-4-1', 'The hallmark presentation of placenta previa is:', '["Painful bleeding","Painless bright red bleeding","Abdominal pain without bleeding","Dark brown spotting"]', 'Painless bright red bleeding', 'Placenta previa classically presents with painless, bright red vaginal bleeding in the late second or third trimester. Unlike abruption, there is no uterine tenderness or contractions.', '{"Painful bleeding":"Painful bleeding is more characteristic of placental abruption.","Painless bright red bleeding":"Correct — the hallmark of placenta previa is painless, bright red vaginal bleeding.","Abdominal pain without bleeding":"Concealed abruption may present this way, but not previa.","Dark brown spotting":"Dark brown blood suggests older bleeding, not typical of acute previa presentation."}', 'easy', '["placenta previa","antepartum hemorrhage","painless bleeding"]', true),
('mcq-047', 't-obs-4-1', 'Digital vaginal examination in suspected placenta previa is:', '["Recommended for diagnosis","Absolutely contraindicated","Optional","Required before ultrasound"]', 'Absolutely contraindicated', 'Digital vaginal examination is absolutely contraindicated in suspected placenta previa as it may disrupt the placenta and cause catastrophic hemorrhage. Diagnosis is made by transabdominal and transvaginal ultrasound.', '{"Recommended for diagnosis":"NEVER perform digital exam in suspected previa.","Absolutely contraindicated":"Correct — digital examination may cause massive hemorrhage.","Optional":"It is not optional; it is strictly prohibited.","Required before ultrasound":"Ultrasound must be performed BEFORE any vaginal examination."}', 'easy', '["placenta previa","contraindication","examination"]', true),
('mcq-048', 't-obs-4-1', 'The recommended delivery for complete placenta previa is:', '["Vaginal delivery at 39 weeks","Cesarean section at 36-37 weeks","Induction at 38 weeks","Expectant management until labor"]', 'Cesarean section at 36-37 weeks', 'Complete (total) placenta previa requires planned cesarean delivery at 36-37 weeks (after confirming fetal lung maturity or administering corticosteroids). Earlier delivery if bleeding is uncontrollable.', '{"Vaginal delivery at 39 weeks":"Vaginal delivery with complete previa would cause massive hemorrhage.","Cesarean section at 36-37 weeks":"Correct — scheduled cesarean at late preterm to balance maturity and hemorrhage risk.","Induction at 38 weeks":"Induction is contraindicated with complete previa.","Expectant management until labor":"Waiting for labor risks uncontrolled hemorrhage."}', 'medium', '["placenta previa","cesarean","delivery timing"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Gestational Diabetes ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-049', 't-obs-3-2', 'GDM screening with glucose challenge test (GCT) is performed at:', '["8-12 weeks","16-20 weeks","24-28 weeks","32-36 weeks"]', '24-28 weeks', 'Universal screening for GDM with a 50g glucose challenge test (GCT) is performed at 24-28 weeks gestation, when insulin resistance is most pronounced due to placental hormones.', '{"8-12 weeks":"Early screening may be done for high-risk patients, but universal screening is at 24-28 weeks.","16-20 weeks":"This is the window for anatomy scan, not routine GDM screening.","24-28 weeks":"Correct — universal GDM screening window.","32-36 weeks":"This is too late for effective intervention and management."}', 'easy', '["GDM","screening","glucose challenge"]', true),
('mcq-050', 't-obs-3-2', 'The threshold for a positive 50g GCT is:', '["≥120 mg/dL","≥130 mg/dL","≥140 mg/dL","≥180 mg/dL"]', '≥140 mg/dL', 'A 1-hour plasma glucose ≥140 mg/dL after 50g GCT is considered positive and requires follow-up with a 3-hour 100g OGTT. Some institutions use ≥130 mg/dL for higher sensitivity.', '{"≥120 mg/dL":"This threshold would have too many false positives.","≥130 mg/dL":"Some centers use this cutoff for higher sensitivity, but standard is ≥140.","≥140 mg/dL":"Correct — standard threshold for positive GCT requiring confirmatory OGTT.","≥180 mg/dL":"At ≥180 mg/dL, some clinicians diagnose GDM without further testing."}', 'medium', '["GDM","GCT","diagnosis"]', true),
('mcq-051', 't-obs-3-2', 'The most common fetal complication of poorly controlled GDM is:', '["IUGR","Macrosomia","Oligohydramnios","Anencephaly"]', 'Macrosomia', 'Macrosomia (birth weight >4000g) is the most common fetal complication of GDM due to fetal hyperinsulinemia in response to maternal hyperglycemia. This increases risk of shoulder dystocia and birth trauma.', '{"IUGR":"IUGR is associated with placental insufficiency and vascular disease, not typical GDM.","Macrosomia":"Correct — fetal hyperinsulinemia drives excessive growth (macrosomia).","Oligohydramnios":"GDM more commonly causes polyhydramnios, not oligohydramnios.","Anencephaly":"Anencephaly is associated with pregestational (pre-existing) diabetes, not GDM."}', 'medium', '["GDM","macrosomia","fetal complications"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: IVF ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-052', 't-rep-3-1', 'The most serious complication of ovarian stimulation in IVF is:', '["Multiple pregnancy","Ovarian torsion","OHSS","Ectopic pregnancy"]', 'OHSS', 'Ovarian hyperstimulation syndrome (OHSS) is the most serious iatrogenic complication of IVF. Severe OHSS includes massive ascites, pleural effusions, renal failure, and thromboembolic events. Prevention strategies include GnRH agonist trigger and freeze-all protocols.', '{"Multiple pregnancy":"Multiple pregnancy is a concern but can be mitigated by single embryo transfer.","Ovarian torsion":"Torsion is possible with enlarged ovaries but is less common than OHSS.","OHSS":"Correct — OHSS is the most serious complication, potentially life-threatening.","Ectopic pregnancy":"Ectopic pregnancy can occur but is not the most serious stimulation-related complication."}', 'medium', '["IVF","OHSS","ovarian stimulation"]', true),
('mcq-053', 't-rep-3-1', 'Oocyte retrieval in IVF is performed how many hours after hCG trigger?', '["12 hours","24 hours","36 hours","48 hours"]', '36 hours', 'Oocyte retrieval is timed at 34-36 hours after hCG (or GnRH agonist) trigger, just before expected ovulation would occur. This ensures oocytes are mature (MII) but still within the follicles.', '{"12 hours":"Too early; follicles are not yet ready for aspiration.","24 hours":"Slightly early; oocytes may not have completed maturation.","36 hours":"Correct — retrieval is timed at 34-36 hours post-trigger.","48 hours":"Too late; ovulation may have already occurred, resulting in empty follicles."}', 'medium', '["IVF","oocyte retrieval","timing"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Hormonal Contraceptives ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-054', 't-gyn-4-1', 'An absolute contraindication to combined oral contraceptives is:', '["Age >30","Migraine with aura","Dysmenorrhea","Acne"]', 'Migraine with aura', 'Migraine with aura significantly increases the risk of ischemic stroke. Combined hormonal contraceptives are WHO Category 4 (absolute contraindication) in women with migraine with aura at any age.', '{"Age >30":"Age alone is not a contraindication; it is a factor when combined with smoking (>35 + smoking).","Migraine with aura":"Correct — WHO Category 4 due to elevated stroke risk.","Dysmenorrhea":"COCs are actually a treatment for dysmenorrhea.","Acne":"COCs with anti-androgenic progestins are used to treat acne."}', 'medium', '["COC","contraindication","migraine"]', true),
('mcq-055', 't-gyn-4-1', 'The primary mechanism of action of COCs is:', '["Thickening cervical mucus","Inhibition of ovulation","Thinning endometrium","Slowing tubal motility"]', 'Inhibition of ovulation', 'The primary mechanism of combined oral contraceptives is suppression of the hypothalamic-pituitary-ovarian axis, preventing the LH surge and thus inhibiting ovulation. Secondary mechanisms include thickening cervical mucus and thinning the endometrium.', '{"Thickening cervical mucus":"This is a secondary mechanism, primary in progestin-only pills.","Inhibition of ovulation":"Correct — suppression of ovulation via HPO axis inhibition is the primary mechanism.","Thinning endometrium":"This is a secondary mechanism that reduces implantation potential.","Slowing tubal motility":"This may occur but is not the primary mechanism."}', 'easy', '["COC","mechanism of action","ovulation"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Pelvic Inflammatory Disease ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-056', 't-gyn-2-1', 'The most common causative organisms of PID are:', '["E. coli and Klebsiella","Chlamydia and Gonorrhea","Streptococcus and Staphylococcus","Candida and Trichomonas"]', 'Chlamydia and Gonorrhea', 'Chlamydia trachomatis and Neisseria gonorrhoeae are the most commonly identified causative organisms of PID, though polymicrobial infections are common. BV-associated organisms and anaerobes also contribute.', '{"E. coli and Klebsiella":"These are common UTI pathogens, not typical PID causes.","Chlamydia and Gonorrhea":"Correct — the two most common sexually transmitted causes of PID.","Streptococcus and Staphylococcus":"These may cause postoperative or postpartum infections but are not primary PID organisms.","Candida and Trichomonas":"Candida causes vulvovaginal candidiasis; Trichomonas causes vaginitis, not PID."}', 'easy', '["PID","Chlamydia","Gonorrhea","causative organisms"]', true),
('mcq-057', 't-gyn-2-1', 'The minimum clinical criteria for empiric treatment of PID is:', '["Positive cervical cultures","Cervical motion tenderness","Fever >38.3°C","Elevated WBC count"]', 'Cervical motion tenderness', 'CDC recommends empiric treatment for PID when cervical motion tenderness OR uterine tenderness OR adnexal tenderness is present in a sexually active young woman with no other cause identified. Waiting for cultures delays treatment.', '{"Positive cervical cultures":"Cultures support the diagnosis but should not delay empiric treatment.","Cervical motion tenderness":"Correct — minimum criterion for empiric PID treatment per CDC.","Fever >38.3°C":"Fever is an additional criterion that supports the diagnosis but is not required.","Elevated WBC count":"Elevated WBC supports PID but is not required for empiric treatment."}', 'medium', '["PID","diagnosis","CDC criteria"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Uterine Fibroids ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-058', 't-gyn-3-1', 'The most common type of uterine fibroid is:', '["Submucosal","Intramural","Subserosal","Pedunculated"]', 'Intramural', 'Intramural fibroids are the most common type, growing within the uterine muscle wall. Submucosal fibroids are less common but most likely to cause heavy bleeding. Subserosal fibroids project outward from the uterus.', '{"Submucosal":"Submucosal fibroids are least common (~5%) but most symptomatic.","Intramural":"Correct — intramural fibroids within the myometrium are the most common type.","Subserosal":"Subserosal fibroids are common but not the most common type.","Pedunculated":"Pedunculated fibroids are a subtype (submucosal or subserosal on a stalk), not the most common."}', 'easy', '["fibroids","uterine leiomyoma","classification"]', true),
('mcq-059', 't-gyn-3-1', 'Fibroids are estrogen and progesterone dependent. They typically shrink after:', '["Pregnancy","Menarche","Menopause","OCP use"]', 'Menopause', 'Fibroids are hormone-dependent tumors that typically shrink after menopause due to the decline in estrogen and progesterone. This is why GnRH agonists (which create a hypoestrogenic state) can shrink fibroids pre-surgically.', '{"Pregnancy":"Fibroids may grow during pregnancy due to increased estrogen.","Menarche":"Menarche marks the onset of estrogen production — fibroids begin growing.","Menopause":"Correct — declining estrogen levels after menopause cause fibroid regression.","OCP use":"OCPs maintain hormonal levels and fibroids usually remain stable."}', 'easy', '["fibroids","menopause","estrogen"]', true)
ON CONFLICT (id) DO NOTHING;

-- ── MCQs: Fetal Heart Rate Monitoring ──
INSERT INTO mcqs (id, topic_id, question, options, correct_answer, explanation, option_explanations, difficulty, tags, is_published) VALUES
('mcq-060', 't-obs-6-2', 'A normal fetal heart rate baseline is:', '["100-120 bpm","110-160 bpm","170-200 bpm","80-100 bpm"]', '110-160 bpm', 'Normal FHR baseline is 110-160 bpm. Baseline <110 is bradycardia, >160 is tachycardia. Baseline is determined over a 10-minute window, excluding accelerations, decelerations, and periods of marked variability.', '{"100-120 bpm":"While 110-120 is within normal, 100-110 may be considered borderline bradycardia.","110-160 bpm":"Correct — the normal FHR baseline range.","170-200 bpm":"This indicates fetal tachycardia.","80-100 bpm":"This represents significant fetal bradycardia requiring immediate evaluation."}', 'easy', '["FHR","baseline","fetal monitoring"]', true)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- DEMO USER PROGRESS, BOOKMARKS, QUIZ ATTEMPTS, RECENT ACTIVITY
-- ═══════════════════════════════════════════════════════════════

-- User completed some topics
INSERT INTO user_progress (user_id, topic_id, is_completed, completed_at) VALUES
('demo-user-001', 't-obs-1-1', true, NOW() - INTERVAL '7 days'),
('demo-user-001', 't-obs-1-2', true, NOW() - INTERVAL '6 days'),
('demo-user-001', 't-obs-1-3', true, NOW() - INTERVAL '5 days'),
('demo-user-001', 't-obs-2-1', true, NOW() - INTERVAL '4 days'),
('demo-user-001', 't-obs-3-1', true, NOW() - INTERVAL '3 days'),
('demo-user-001', 't-gyn-1-1', true, NOW() - INTERVAL '2 days'),
('demo-user-001', 't-gyn-3-3', true, NOW() - INTERVAL '1 day'),
('demo-user-001', 't-rep-1-2', true, NOW() - INTERVAL '12 hours'),
('demo-user-001', 't-rep-4-1', false, NULL),
('demo-user-001', 't-obs-5-1', false, NULL);

-- Bookmarks
INSERT INTO bookmarks (user_id, topic_id) VALUES
('demo-user-001', 't-obs-3-1'),
('demo-user-001', 't-obs-1-2'),
('demo-user-001', 't-gyn-3-3'),
('demo-user-001', 't-rep-4-1'),
('demo-user-001', 't-obs-5-1');

-- Recent activity
INSERT INTO recent_activity (user_id, topic_id, viewed_at) VALUES
('demo-user-001', 't-rep-4-1', NOW() - INTERVAL '1 hour'),
('demo-user-001', 't-rep-1-2', NOW() - INTERVAL '3 hours'),
('demo-user-001', 't-gyn-3-3', NOW() - INTERVAL '6 hours'),
('demo-user-001', 't-obs-5-1', NOW() - INTERVAL '12 hours'),
('demo-user-001', 't-gyn-1-1', NOW() - INTERVAL '1 day'),
('demo-user-001', 't-obs-3-1', NOW() - INTERVAL '2 days'),
('demo-user-001', 't-obs-2-1', NOW() - INTERVAL '3 days'),
('demo-user-001', 't-obs-1-3', NOW() - INTERVAL '4 days'),
('demo-user-001', 't-obs-1-2', NOW() - INTERVAL '5 days'),
('demo-user-001', 't-obs-1-1', NOW() - INTERVAL '6 days');

-- Quiz attempts (varied scores and modes)
INSERT INTO quiz_attempts (user_id, topic_id, mode, score, total_questions, correct_count, wrong_count, time_taken, answers, created_at) VALUES
('demo-user-001', 't-obs-1-1', 'topic', 80, 5, 4, 1, 180, '[{"mcqId":"mcq-001","selectedAnswer":"Ampulla of the fallopian tube","isCorrect":true},{"mcqId":"mcq-002","selectedAnswer":"Day 6-7","isCorrect":true},{"mcqId":"mcq-003","selectedAnswer":"Prevents polyspermy","isCorrect":true},{"mcqId":"mcq-004","selectedAnswer":"hCG","isCorrect":true},{"mcqId":"mcq-005","selectedAnswer":"Ovary","isCorrect":false}]', NOW() - INTERVAL '7 days'),
('demo-user-001', 't-obs-1-2', 'topic', 60, 5, 3, 2, 240, '[{"mcqId":"mcq-006","selectedAnswer":"30-50%","isCorrect":true},{"mcqId":"mcq-007","selectedAnswer":"30 mmHg","isCorrect":true},{"mcqId":"mcq-008","selectedAnswer":"Normal renal function","isCorrect":false},{"mcqId":"mcq-009","selectedAnswer":"Increased protein C","isCorrect":true},{"mcqId":"mcq-010","selectedAnswer":"Iron deficiency","isCorrect":false}]', NOW() - INTERVAL '6 days'),
('demo-user-001', 't-obs-3-1', 'topic', 100, 5, 5, 0, 150, '[{"mcqId":"mcq-011","selectedAnswer":"BP ≥160/110 or end-organ dysfunction","isCorrect":true},{"mcqId":"mcq-012","selectedAnswer":"Delivery","isCorrect":true},{"mcqId":"mcq-013","selectedAnswer":"Leukocytosis","isCorrect":true},{"mcqId":"mcq-014","selectedAnswer":"≥34 weeks","isCorrect":true},{"mcqId":"mcq-015","selectedAnswer":"4-6 g IV","isCorrect":true}]', NOW() - INTERVAL '3 days'),
('demo-user-001', 't-gyn-1-1', 'topic', 80, 5, 4, 1, 200, '[{"mcqId":"mcq-021","selectedAnswer":"Polyp","isCorrect":true},{"mcqId":"mcq-022","selectedAnswer":"≥45 years","isCorrect":true},{"mcqId":"mcq-023","selectedAnswer":"LNG-IUS (Mirena)","isCorrect":true},{"mcqId":"mcq-024","selectedAnswer":"Coagulopathy","isCorrect":true},{"mcqId":"mcq-025","selectedAnswer":"Inhibiting prostaglandins","isCorrect":false}]', NOW() - INTERVAL '2 days'),
('demo-user-001', NULL, 'random', 70, 10, 7, 3, 420, '[{"mcqId":"mcq-001","selectedAnswer":"Ampulla of the fallopian tube","isCorrect":true},{"mcqId":"mcq-011","selectedAnswer":"BP ≥160/110 or end-organ dysfunction","isCorrect":true},{"mcqId":"mcq-021","selectedAnswer":"Polyp","isCorrect":true},{"mcqId":"mcq-031","selectedAnswer":"36 hours","isCorrect":true},{"mcqId":"mcq-036","selectedAnswer":"2 of 3","isCorrect":true},{"mcqId":"mcq-026","selectedAnswer":"Types 16 and 18","isCorrect":true},{"mcqId":"mcq-041","selectedAnswer":"Uterine atony","isCorrect":true},{"mcqId":"mcq-007","selectedAnswer":"35 mmHg","isCorrect":false},{"mcqId":"mcq-028","selectedAnswer":"Rb","isCorrect":false},{"mcqId":"mcq-038","selectedAnswer":"30-40%","isCorrect":false}]', NOW() - INTERVAL '1 day'),
('demo-user-001', 't-rep-4-1', 'topic', 60, 5, 3, 2, 300, '[{"mcqId":"mcq-036","selectedAnswer":"2 of 3","isCorrect":true},{"mcqId":"mcq-037","selectedAnswer":"Clomiphene citrate","isCorrect":false},{"mcqId":"mcq-038","selectedAnswer":"50-70%","isCorrect":true},{"mcqId":"mcq-039","selectedAnswer":"5-10%","isCorrect":true},{"mcqId":"mcq-040","selectedAnswer":"Ovarian cancer","isCorrect":false}]', NOW() - INTERVAL '6 hours');

-- Spaced repetition review schedule (some due now, some future)
INSERT INTO review_schedule (user_id, mcq_id, ease_factor, "interval", repetitions, next_review_at, last_reviewed_at) VALUES
('demo-user-001', 'mcq-001', 260, 6, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '6 days'),
('demo-user-001', 'mcq-003', 250, 1, 1, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1 day'),
('demo-user-001', 'mcq-005', 230, 1, 0, NOW() + INTERVAL '2 hours', NOW() - INTERVAL '12 hours'),
('demo-user-001', 'mcq-008', 220, 1, 0, NOW(), NOW() - INTERVAL '1 day'),
('demo-user-001', 'mcq-010', 250, 3, 2, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 days'),
('demo-user-001', 'mcq-011', 280, 10, 4, NOW() + INTERVAL '3 days', NOW() - INTERVAL '10 days'),
('demo-user-001', 'mcq-015', 250, 1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 day'),
('demo-user-001', 'mcq-028', 210, 1, 0, NOW(), NOW() - INTERVAL '1 day'),
('demo-user-001', 'mcq-037', 230, 1, 0, NOW() + INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
('demo-user-001', 'mcq-040', 240, 1, 0, NOW() + INTERVAL '12 hours', NOW() - INTERVAL '6 hours');


-- ═══════════════════════════════════════════════════════════════
-- Indexes (without CONCURRENTLY since inside transaction)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_topic ON user_progress (user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_topic ON bookmarks (user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON quiz_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_id ON recent_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_topic ON recent_activity (user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_viewed ON recent_activity (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters (book_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter_id ON topics (chapter_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_topic_id ON content_blocks (topic_id);
CREATE INDEX IF NOT EXISTS idx_mcqs_topic_id ON mcqs (topic_id);
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chapters_title_trgm ON chapters USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_topics_title_trgm ON topics USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_books_published ON books (is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_chapters_published_book ON chapters (book_id, "order") WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_topics_published_chapter ON topics (chapter_id, "order") WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_mcqs_published_topic ON mcqs (topic_id) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_review_schedule_user_id ON review_schedule (user_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_user_due ON review_schedule (user_id, next_review_at ASC);
CREATE INDEX IF NOT EXISTS idx_content_reports_user_id ON content_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports (status);
CREATE INDEX IF NOT EXISTS idx_content_reports_pending ON content_reports (created_at DESC) WHERE status = 'pending';

-- Done!
SELECT 'SEED COMPLETE' AS status,
  (SELECT COUNT(*) FROM books) AS books,
  (SELECT COUNT(*) FROM chapters) AS chapters,
  (SELECT COUNT(*) FROM topics) AS topics,
  (SELECT COUNT(*) FROM content_blocks) AS content_blocks,
  (SELECT COUNT(*) FROM mcqs) AS mcqs,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM user_progress) AS progress,
  (SELECT COUNT(*) FROM bookmarks) AS bookmarks,
  (SELECT COUNT(*) FROM quiz_attempts) AS quiz_attempts,
  (SELECT COUNT(*) FROM recent_activity) AS recent_activity,
  (SELECT COUNT(*) FROM review_schedule) AS review_schedule;
