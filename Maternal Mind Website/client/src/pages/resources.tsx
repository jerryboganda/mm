import { Link, useRoute } from "wouter";
import {
  BookOpen, Brain, ArrowRight, ChevronRight, CheckCircle2,
  GraduationCap, Target, FileText, Clock, Award, Lightbulb
} from "lucide-react";
import {
  GlassCard, GlassPanel, NeonButton, GhostButton, GlowLink,
  SectionLabel, ScrollReveal, BackgroundOrbs
} from "@/components/glass-components";
import { SEO } from "@/components/seo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ResourcePageData {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof BookOpen;
  studyStrategy: string[];
  howItHelps: string[];
  faqs: { q: string; a: string }[];
  relatedLinks: { label: string; href: string }[];
}

const resourcePages: ResourcePageData[] = [
  {
    slug: "mrcog-part-1",
    title: "MRCOG Part 1",
    subtitle: "Foundation Sciences for Obstetrics & Gynaecology",
    description: "Comprehensive preparation for the MRCOG Part 1 examination covering basic sciences, anatomy, physiology, pathology, and pharmacology relevant to Obstetrics and Gynaecology.",
    icon: GraduationCap,
    studyStrategy: [
      "Start with anatomy and embryology — they form the foundation for clinical understanding",
      "Focus on high-yield topics like physiology of pregnancy and pharmacology of common drugs",
      "Use spaced repetition with MCQs to consolidate basic science knowledge",
      "Dedicate time to endocrinology and the menstrual cycle — frequently tested areas",
      "Create a structured study timetable covering all syllabus domains",
    ],
    howItHelps: [
      "Structured content library organised by Part 1 syllabus topics",
      "Topic-specific MCQ practice mirroring exam question styles",
      "Progress analytics to track readiness across all domains",
      "Bookmark system for quick revision of challenging topics",
      "Wrong-questions mode to target areas needing improvement",
    ],
    faqs: [
      { q: "What is the pass rate for MRCOG Part 1?", a: "The pass rate varies by sitting but typically ranges between 25-40%. This underscores the importance of thorough, structured preparation with focused practice." },
      { q: "How long should I prepare for Part 1?", a: "Most successful candidates prepare for 6-12 months, depending on their background. Consistent daily study of 1-2 hours is more effective than irregular intensive sessions." },
      { q: "Does Maternal Mind cover the complete Part 1 syllabus?", a: "Our content is aligned to the RCOG Part 1 syllabus and covers core domains. We continuously expand our question bank and learning materials." },
    ],
    relatedLinks: [
      { label: "MRCOG Part 2 Preparation", href: "/resources/mrcog-part-2" },
      { label: "MRCOG Part 3 Preparation", href: "/resources/mrcog-part-3" },
      { label: "OB-GYN MCQ Practice", href: "/resources/obgyn-mcqs" },
    ],
  },
  {
    slug: "mrcog-part-2",
    title: "MRCOG Part 2",
    subtitle: "Clinical Knowledge in Obstetrics & Gynaecology",
    description: "Targeted preparation for the MRCOG Part 2 written examination, focusing on clinical knowledge application through SBAs and EMQs across all obstetric and gynaecological domains.",
    icon: Brain,
    studyStrategy: [
      "Master clinical management guidelines — RCOG Green-top, NICE, and FIGO recommendations",
      "Practice SBA-style questions regularly to build exam technique",
      "Focus on clinical reasoning rather than rote memorisation",
      "Study obstetric emergencies and gynaecological oncology thoroughly",
      "Supplement with case-based learning for complex scenarios",
    ],
    howItHelps: [
      "Clinical content structured around Part 2 examination domains",
      "Exam-style MCQs with clinical scenario-based questions",
      "Detailed explanations referencing current guidelines",
      "Accuracy trends help identify clinical areas needing attention",
      "Mixed-mode practice for comprehensive exam simulation",
    ],
    faqs: [
      { q: "What format is the MRCOG Part 2 exam?", a: "Part 2 consists of two papers with Single Best Answers (SBAs) and Extended Matching Questions (EMQs) testing clinical knowledge application." },
      { q: "What are the key topics for Part 2?", a: "High-yield areas include maternal medicine, fetal medicine, gynaecological oncology, reproductive medicine, and urogynaecology. Our content covers all these domains." },
      { q: "How does Part 2 differ from Part 1?", a: "Part 2 focuses on clinical application rather than basic sciences. Questions present clinical scenarios requiring management decisions based on current evidence." },
    ],
    relatedLinks: [
      { label: "MRCOG Part 1 Preparation", href: "/resources/mrcog-part-1" },
      { label: "MRCOG Part 3 Preparation", href: "/resources/mrcog-part-3" },
      { label: "FCPS OB-GYN Preparation", href: "/resources/fcps-obgyn" },
    ],
  },
  {
    slug: "mrcog-part-3",
    title: "MRCOG Part 3",
    subtitle: "Clinical Skills Assessment (OSCE)",
    description: "Preparation support for the MRCOG Part 3 clinical assessment, focusing on the knowledge foundation needed for clinical tasks, communication skills, and structured approaches to patient management.",
    icon: Award,
    studyStrategy: [
      "Develop systematic approaches to clinical scenarios (history, examination, management)",
      "Practice structured communication frameworks for breaking bad news and counselling",
      "Review guidelines for common clinical presentations in depth",
      "Focus on practical decision-making under time pressure",
      "Build knowledge of multidisciplinary management approaches",
    ],
    howItHelps: [
      "Comprehensive topic coverage supporting clinical reasoning",
      "Knowledge reinforcement for clinical scenario discussions",
      "Study content aligned to common OSCE station themes",
      "Progress tracking across clinical domains",
      "Rapid revision tools for last-minute preparation",
    ],
    faqs: [
      { q: "What is the MRCOG Part 3 format?", a: "Part 3 is an Objective Structured Clinical Examination (OSCE) consisting of 14 stations testing clinical, communication, and practical skills in a simulated environment." },
      { q: "Can an app help with Part 3 preparation?", a: "While Part 3 requires practical skills, strong clinical knowledge is essential. Maternal Mind helps reinforce the knowledge base needed for confident clinical performance." },
      { q: "What skills are assessed in Part 3?", a: "Stations assess patient assessment, communication, information gathering, clinical management, and patient safety across obstetric and gynaecological scenarios." },
    ],
    relatedLinks: [
      { label: "MRCOG Part 1 Preparation", href: "/resources/mrcog-part-1" },
      { label: "MRCOG Part 2 Preparation", href: "/resources/mrcog-part-2" },
      { label: "OB-GYN MCQ Practice", href: "/resources/obgyn-mcqs" },
    ],
  },
  {
    slug: "fcps-obgyn",
    title: "FCPS Obstetrics & Gynaecology",
    subtitle: "CPSP Fellowship Examination Preparation",
    description: "Comprehensive preparation support for the FCPS examination in Obstetrics & Gynaecology administered by the College of Physicians and Surgeons Pakistan (CPSP), covering both Part 1 and Part 2 domains.",
    icon: Target,
    studyStrategy: [
      "Master basic sciences alongside clinical knowledge from the start",
      "Focus on clinical scenarios relevant to the South Asian context",
      "Practice MCQs from multiple sources to build exam familiarity",
      "Allocate extra time to obstetric emergencies and high-risk pregnancies",
      "Review pharmacology and therapeutics used in local practice settings",
    ],
    howItHelps: [
      "Content coverage relevant to FCPS examination syllabi",
      "MCQ practice with questions suited to CPSP exam patterns",
      "Topic-level granularity for targeted domain preparation",
      "Analytics to track progress across different subject areas",
      "Offline access for studying in areas with limited connectivity",
    ],
    faqs: [
      { q: "Is the content aligned to the CPSP syllabus?", a: "Our content covers the major domains of the FCPS OB-GYN curriculum. While designed broadly for OB-GYN education, many topics directly support FCPS preparation." },
      { q: "How is FCPS different from MRCOG?", a: "While both are postgraduate qualifications, FCPS follows the CPSP curriculum and examination pattern, with some differences in emphasis and clinical context compared to MRCOG." },
      { q: "Does Maternal Mind support FCPS Part 2?", a: "Our platform supports the knowledge component of FCPS preparation. Clinical skills for Part 2 require additional practical training alongside theoretical knowledge." },
    ],
    relatedLinks: [
      { label: "MRCOG Part 1 Preparation", href: "/resources/mrcog-part-1" },
      { label: "MRCOG Part 2 Preparation", href: "/resources/mrcog-part-2" },
      { label: "OB-GYN MCQ Practice", href: "/resources/obgyn-mcqs" },
    ],
  },
  {
    slug: "obgyn-mcqs",
    title: "OB-GYN MCQ Practice",
    subtitle: "Comprehensive Question Bank for OB-GYN Professionals",
    description: "Access a growing collection of multiple-choice questions covering all areas of Obstetrics and Gynaecology, designed for exam preparation and continuous professional development.",
    icon: Brain,
    studyStrategy: [
      "Start with topic-specific MCQs to build foundation knowledge",
      "Progress to mixed-mode questions for comprehensive exam simulation",
      "Use wrong-questions mode to systematically address weak areas",
      "Review explanations thoroughly — even for questions answered correctly",
      "Track your accuracy trends over time to measure improvement",
    ],
    howItHelps: [
      "Thousands of MCQs across all OB-GYN domains",
      "Multiple practice modes: topic, mixed, and wrong-questions",
      "Detailed explanations with referenced rationale",
      "Real-time accuracy tracking and performance analytics",
      "Bookmark challenging questions for later review",
    ],
    faqs: [
      { q: "How many MCQs are available?", a: "Our question bank contains over 3,000 MCQs and is continuously expanding. Questions cover obstetrics, gynaecology, reproductive medicine, and related subspecialties." },
      { q: "Are the questions exam-standard?", a: "Our questions are designed to reflect the style and difficulty of major postgraduate examinations. They are developed and reviewed to ensure clinical accuracy and educational value." },
      { q: "Can I track which topics I need to improve?", a: "Yes. Our analytics dashboard shows your accuracy across all topics, highlights weak areas, and helps you focus your study time where it matters most." },
    ],
    relatedLinks: [
      { label: "MRCOG Part 1 Preparation", href: "/resources/mrcog-part-1" },
      { label: "FCPS OB-GYN Preparation", href: "/resources/fcps-obgyn" },
      { label: "View All Features", href: "/features" },
    ],
  },
];

export function ResourcesHub() {
  return (
    <div className="min-h-screen bg-void">
      <SEO title="Study Resources" description="Free OB-GYN exam preparation guides for MRCOG Parts 1-3, FCPS, and MCQ practice. Expert study strategies and tips from Maternal Mind." path="/resources" />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <SectionLabel className="mb-4 inline-block">Resources</SectionLabel>
            <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight mb-6">
              Study Guides &
              <span className="block text-[#11a4d4] neon-text-glow font-normal mt-1">Exam Preparation</span>
            </h1>
            <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed">
              Explore dedicated preparation guides for major OB-GYN examinations. Each guide includes study strategies, exam insights, and how Maternal Mind can support your journey.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resourcePages.map((page, i) => (
              <ScrollReveal key={i} delay={i * 0.05}>
                <Link href={`/resources/${page.slug}`}>
                  <GlassCard className="p-6 glass-hover transition-all duration-300 cursor-pointer h-full">
                    <div className="w-10 h-10 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center mb-4">
                      <page.icon className="w-5 h-5 text-[#11a4d4]" />
                    </div>
                    <h3 className="text-base font-medium text-white mb-1">{page.title}</h3>
                    <p className="text-xs text-white/40 mb-3">{page.subtitle}</p>
                    <p className="text-sm text-white/50 leading-relaxed mb-4">{page.description.slice(0, 120)}...</p>
                    <span className="text-sm text-[#11a4d4] flex items-center gap-1">
                      Read guide <ArrowRight className="w-3 h-3" />
                    </span>
                  </GlassCard>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ResourcePage({ slug }: { slug: string }) {
  const page = resourcePages.find((p) => p.slug === slug);
  if (!page) return null;

  return (
    <div className="min-h-screen bg-void">
      <SEO title={page.title} description={page.description} path={`/resources/${page.slug}`} />
      <BackgroundOrbs />
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="mb-4">
              <GlowLink href="/resources" className="text-sm flex items-center gap-1">
                Resources <ChevronRight className="w-3 h-3" /> {page.title}
              </GlowLink>
            </div>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-md bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0">
                <page.icon className="w-6 h-6 text-[#11a4d4]" />
              </div>
              <div>
                <h1 className="text-3xl font-light text-white tracking-tight">{page.title}</h1>
                <p className="text-sm text-white/50 mt-1">{page.subtitle}</p>
              </div>
            </div>
            <p className="text-base text-white/60 leading-relaxed">{page.description}</p>
          </ScrollReveal>
        </div>
      </section>

      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <GlassCard className="p-6 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#11a4d4]" />
                Study Strategy
              </h2>
              <ul className="space-y-3">
                {page.studyStrategy.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <span className="text-sm text-white/70 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <GlassCard className="p-6 mb-8" glow>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-[#11a4d4]" />
                How Maternal Mind Helps
              </h2>
              <ul className="space-y-3">
                {page.howItHelps.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#11a4d4]/10 border border-[#11a4d4]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-[#11a4d4]" />
                    </div>
                    <span className="text-sm text-white/70 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <NeonButton size="sm" data-testid={`button-resource-${slug}-cta`}>
                  Get Started <ArrowRight className="w-4 h-4" />
                </NeonButton>
              </div>
            </GlassCard>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <GlassCard className="p-2 mb-8">
              <h2 className="text-lg font-semibold text-white px-4 pt-4 pb-2">
                Frequently Asked Questions
              </h2>
              <Accordion type="single" collapsible>
                {page.faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-white/5">
                    <AccordionTrigger className="px-4 py-4 text-sm text-white/90 hover:text-[#11a4d4] hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm text-white/60 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </GlassCard>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <GlassPanel className="p-5">
              <h3 className="text-sm font-medium text-white mb-3">Related Resources</h3>
              <div className="flex flex-wrap gap-2">
                {page.relatedLinks.map((link, i) => (
                  <Link key={i} href={link.href}>
                    <GhostButton size="sm">
                      {link.label} <ChevronRight className="w-3 h-3" />
                    </GhostButton>
                  </Link>
                ))}
              </div>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
