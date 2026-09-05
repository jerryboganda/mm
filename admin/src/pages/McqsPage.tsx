import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import BlockEditor, { ContentBlock } from "../components/BlockEditor";
import MultiSelect from "../components/MultiSelect";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Globe,
  Search,
  Upload,
  Loader2,
  AlertCircle,
  ClipboardList,
  X,
  CheckCircle2,
  Check,
  Archive,
  ArchiveRestore,
  Layers,
} from "lucide-react";

function parseExplanationToBlocks(
  explanationStr: string | null | undefined,
): ContentBlock[] {
  if (!explanationStr || !explanationStr.trim()) {
    return [
      { id: `block-${Date.now()}-0`, type: "text", content: "", order: 0 },
    ];
  }
  const trimmed = explanationStr.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: any, idx: number) => ({
          id: b.id || `block-${Date.now()}-${idx}`,
          type: b.type || "text",
          content: b.content || "",
          order: typeof b.order === "number" ? b.order : idx,
        }));
      }
    } catch {
      // Fallback to text block if JSON parsing fails
    }
  }
  return [
    {
      id: `block-${Date.now()}-0`,
      type: "text",
      content: explanationStr,
      order: 0,
    },
  ];
}

function serializeBlocksToExplanation(blocks: ContentBlock[]): string {
  const activeBlocks = blocks.filter((b) => {
    if (!b.content) return false;
    if (b.type === "text" || b.type === "html") {
      return b.content.replace(/<[^>]*>/g, "").trim().length > 0;
    }
    return b.content.trim().length > 0;
  });

  if (activeBlocks.length === 0) return "";
  if (
    activeBlocks.length === 1 &&
    (activeBlocks[0].type === "text" || activeBlocks[0].type === "html")
  ) {
    return activeBlocks[0].content;
  }
  return JSON.stringify(activeBlocks);
}

export function normalizeOptionsMap(
  rawOptions: unknown,
): Record<string, string> {
  if (!rawOptions) return {};
  let options = rawOptions;
  if (typeof options === "string") {
    try {
      options = JSON.parse(options);
    } catch {
      return {};
    }
  }
  if (Array.isArray(options)) {
    const map: Record<string, string> = {};
    const fallbackLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
    options.forEach((item, idx) => {
      const fallback = fallbackLabels[idx] || String.fromCharCode(65 + idx);
      if (typeof item === "string") {
        map[fallback] = item;
      } else if (item && typeof item === "object") {
        const label = String(
          (item as any).label || (item as any).key || fallback,
        )
          .toUpperCase()
          .trim();
        const text = String(
          (item as any).text ??
            (item as any).value ??
            (item as any).option ??
            (item as any).content ??
            "",
        );
        map[label] = text;
      }
    });
    return map;
  }
  if (typeof options === "object") {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(options as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        map[k.toUpperCase().trim()] = String(v);
      }
    }
    return map;
  }
  return {};
}

export function normalizeOptionExplanationsMap(
  rawExpls: unknown,
): Record<string, string> {
  if (!rawExpls) return {};
  let expls = rawExpls;
  if (typeof expls === "string") {
    try {
      expls = JSON.parse(expls);
    } catch {
      return {};
    }
  }
  if (Array.isArray(expls)) {
    const map: Record<string, string> = {};
    const fallbackLabels = ["A", "B", "C", "D", "E"];
    expls.forEach((item, idx) => {
      const fallback = fallbackLabels[idx] || String.fromCharCode(65 + idx);
      if (typeof item === "string") {
        map[fallback] = item;
      } else if (item && typeof item === "object") {
        const label = String(
          (item as any).label || (item as any).key || fallback,
        )
          .toUpperCase()
          .trim();
        const text = String(
          (item as any).text ??
            (item as any).explanation ??
            (item as any).value ??
            "",
        );
        map[label] = text;
      }
    });
    return map;
  }
  if (typeof expls === "object") {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(expls as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        map[k.toUpperCase().trim()] = String(v);
      }
    }
    return map;
  }
  return {};
}

function TopicGroupOptions({
  groups,
  showBook,
}: {
  groups: { chapterTitle: string; bookTitle: string; topics: TopicRef[] }[];
  showBook: boolean;
}) {
  return (
    <>
      {groups.map((g) => (
        <optgroup
          key={`${g.bookTitle}›${g.chapterTitle}`}
          label={
            showBook && g.bookTitle
              ? `${g.bookTitle} › ${g.chapterTitle}`
              : g.chapterTitle
          }
        >
          {g.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

interface MCQRow {  id: string;
  topicId: string;
  question: string;
  options: any;
  correctAnswer: string;
  explanation: string | null;
  difficulty: string;
  isPublished: boolean;
  isPaid: boolean;
  createdAt: string;
  seq: number;
  year: number | null;
  sourceId: string | null;
  institutionId: string | null;
  questionType: string | null;
  examType: string | null;
  isArchived: boolean;
  references: string | null;
  tags: string[] | null;
  sourceName: string | null;
  subjectName: string | null;
  chapterTitle: string | null;
  topicTitle: string | null;
  attempts: number;
  correct: number;
}

interface TopicRef {
  id: string;
  title: string;
  chapterId: string;
  chapterTitle: string;
  subjectId: string | null;
  subjectTitle: string | null;
  bookId: string;
  bookTitle: string;
}

interface SourceRef {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
  mcqCount: number;
}

interface InstitutionRef {
  id: string;
  name: string;
  isActive: boolean;
  mcqCount: number;
}

interface SubjectRef {
  id: string;
  title: string;
  bookId: string;
}

interface Facets {
  years: number[];
  tags: { tag: string; count: number }[];
  examTypes: string[];
  questionTypes: string[];
}

const QUESTION_TYPES = [
  { value: "single_best", label: "Single Best Answer" },
  { value: "multiple_true", label: "Multiple True/False" },
  { value: "negative", label: "Negative (EXCEPT/NOT)" },
  { value: "assertion_reason", label: "Assertion–Reason" },
  { value: "image_based", label: "Image-Based" },
  { value: "clinical_vignette", label: "Clinical Vignette" },
];

const YEAR_OPTIONS = Array.from({ length: 2026 - 2017 + 1 }, (_, i) =>
  String(2026 - i),
);

const SORT_OPTIONS = [
  { value: "seq_asc", label: "Original order (as added)" },
  { value: "seq_desc", label: "Newest added" },
  { value: "year_asc", label: "Year ↑" },
  { value: "year_desc", label: "Year ↓" },
  { value: "difficulty", label: "Difficulty" },
  { value: "chapter_asc", label: "Topic (A–Z)" },
  { value: "most_attempted", label: "Most attempted" },
  { value: "lowest_accuracy", label: "Lowest accuracy" },
];

const ATTRIBUTE_OPTIONS = [
  { value: "", label: "Any attributes" },
  { value: "hasExplanation", label: "Has explanation" },
  { value: "noExplanation", label: "No explanation" },
  { value: "hasImage", label: "Has image" },
  { value: "noImage", label: "No image" },
  { value: "hasYear", label: "Has year" },
  { value: "noYear", label: "No year" },
  { value: "hasSource", label: "Has source" },
  { value: "noSource", label: "No source" },
];

const PAGE_SIZE = 20;

export default function McqsPage() {
  const [mcqs, setMcqs] = useState<MCQRow[]>([]);
  const [total, setTotal] = useState(0);
  const [topicsList, setTopics] = useState<TopicRef[]>([]);
  const [sourcesList, setSources] = useState<SourceRef[]>([]);
  const [institutionsList, setInstitutions] = useState<InstitutionRef[]>([]);
  const [subjectsList, setSubjects] = useState<SubjectRef[]>([]);
  const [facets, setFacets] = useState<Facets>({
    years: [],
    tags: [],
    examTypes: [],
    questionTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fBook, setFBook] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fChapter, setFChapter] = useState("");
  const [fTopicIds, setFTopicIds] = useState<string[]>([]);
  const [fYears, setFYears] = useState<string[]>([]);
  const [fSources, setFSources] = useState<string[]>([]);
  const [fDifficulties, setFDifficulties] = useState<string[]>([]);
  const [fTags, setFTags] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState("");
  const [fPaid, setFPaid] = useState("");
  const [fAttribute, setFAttribute] = useState("");
  const [fSort, setFSort] = useState("seq_asc");

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkYear, setBulkYear] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editMcq, setEditMcq] = useState<MCQRow | null>(null);
  const [previewMcq, setPreviewMcq] = useState<MCQRow | null>(null);
  const [form, setForm] = useState({
    topicId: "",
    question: "",
    optA: "",
    optB: "",
    optC: "",
    optD: "",
    optE: "",
    correctAnswer: "A",
    explanation: "",
    explanationBlocks: [] as ContentBlock[],
    explA: "",
    explB: "",
    explC: "",
    explD: "",
    explE: "",
    difficulty: "medium",
    references: "",
    tags: "",
    isPaid: false,
    year: "",
    sourceId: "",
    institutionId: "",
    questionType: "single_best",
    examType: "",
    isPublished: true,
    isArchived: false,
  });
  const [newSourceName, setNewSourceName] = useState("");
  const [newInstitutionName, setNewInstitutionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importTopicId, setImportTopicId] = useState("");
  const [importYear, setImportYear] = useState("");
  const [importSourceId, setImportSourceId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cacheRef = useRef<{
    topics?: TopicRef[];
    sources?: SourceRef[];
    institutions?: InstitutionRef[];
    subjects?: SubjectRef[];
  }>({});
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const books = useMemo(() => {
    const map = new Map<string, string>();
    topicsList.forEach((t) => map.set(t.bookId, t.bookTitle));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [topicsList]);

  const chapterOptions = useMemo(() => {
    const map = new Map<string, string>();
    topicsList
      .filter(
        (t) =>
          (!fBook || t.bookId === fBook) &&
          (!fSubject || t.subjectId === fSubject),
      )
      .forEach((t) => map.set(t.chapterId, t.chapterTitle));
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [topicsList, fBook, fSubject]);

  const subtopicOptions = useMemo(
    () =>
      topicsList
        .filter((t) => !fChapter || t.chapterId === fChapter)
        .map((t) => ({ value: t.id, label: `${t.chapterTitle} › ${t.title}` })),
    [topicsList, fChapter],
  );

  // Topics grouped by chapter so dropdowns show short topic names only
  // (e.g. "1. HEAVY MENSTRUAL BLEEDING") under a chapter heading instead
  // of one long "Book › Subject › Chapter › Topic" string per option.
  const topicsByChapter = useMemo(() => {
    const map = new Map<
      string,
      { chapterTitle: string; bookTitle: string; topics: TopicRef[] }
    >();
    topicsList.forEach((t) => {
      const key = t.chapterId || "__none";
      let g = map.get(key);
      if (!g) {
        g = {
          chapterTitle: t.chapterTitle || "Other",
          bookTitle: t.bookTitle || "",
          topics: [],
        };
        map.set(key, g);
      }
      g.topics.push(t);
    });
    return Array.from(map.values());
  }, [topicsList]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>([...facets.years.map(String), ...YEAR_OPTIONS]);
    return Array.from(set).map((y) => ({ value: y, label: y }));
  }, [facets.years]);

  const sourceOptions = useMemo(
    () =>
      sourcesList
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: s.name, hint: String(s.mcqCount) })),
    [sourcesList],
  );

  const tagOptions = useMemo(
    () =>
      facets.tags.map((t) => ({
        value: t.tag,
        label: t.tag,
        hint: String(t.count),
      })),
    [facets.tags],
  );

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort: fSort,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (fBook) params.set("bookId", fBook);
      if (fSubject) params.set("subjectId", fSubject);
      if (fChapter) params.set("chapterId", fChapter);
      if (fTopicIds.length) params.set("topicIds", fTopicIds.join(","));
      if (fYears.length) params.set("years", fYears.join(","));
      if (fSources.length) params.set("sourceIds", fSources.join(","));
      if (fDifficulties.length)
        params.set("difficulties", fDifficulties.join(","));
      if (fTags.length) params.set("tags", fTags.join(","));
      if (fStatus) params.set("status", fStatus);
      if (fPaid) params.set("isPaid", fPaid);
      if (fAttribute) {
        const attrMap: Record<string, [string, string]> = {
          hasExplanation: ["hasExplanation", "true"],
          noExplanation: ["hasExplanation", "false"],
          hasImage: ["hasImage", "true"],
          noImage: ["hasImage", "false"],
          hasYear: ["hasYear", "true"],
          noYear: ["hasYear", "false"],
          hasSource: ["hasSource", "true"],
          noSource: ["hasSource", "false"],
        };
        const [key, value] = attrMap[fAttribute];
        params.set(key, value);
      }

      const [result, topics, sources, institutions, subjects, facetRes] =
        await Promise.all([
          api.get<{ data: MCQRow[]; total: number }>(
            `/admin/content/mcqs?${params}`,
          ),
          cacheRef.current.topics
            ? Promise.resolve(cacheRef.current.topics)
            : api.get<TopicRef[]>("/admin/content/topics/all"),
          cacheRef.current.sources
            ? Promise.resolve(cacheRef.current.sources)
            : api.get<SourceRef[]>("/admin/content/sources"),
          cacheRef.current.institutions
            ? Promise.resolve(cacheRef.current.institutions)
            : api.get<InstitutionRef[]>("/admin/content/institutions"),
          cacheRef.current.subjects
            ? Promise.resolve(cacheRef.current.subjects)
            : api.get<SubjectRef[]>("/admin/content/subjects"),
          api.get<Facets>("/admin/content/mcqs/facets"),
        ]);
      setMcqs(result.data);
      setTotal(result.total);
      if (Array.isArray(topics)) {
        cacheRef.current.topics = topics;
        setTopics(topics);
      }
      if (Array.isArray(sources)) {
        cacheRef.current.sources = sources;
        setSources(sources);
      }
      if (Array.isArray(institutions)) {
        cacheRef.current.institutions = institutions;
        setInstitutions(institutions);
      }
      if (Array.isArray(subjects)) {
        cacheRef.current.subjects = subjects;
        setSubjects(subjects);
      }
      setFacets(facetRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    fBook,
    fSubject,
    fChapter,
    fTopicIds,
    fYears,
    fSources,
    fDifficulties,
    fTags,
    fStatus,
    fPaid,
    fAttribute,
    fSort,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (debouncedSearch)
      chips.push({
        key: "search",
        label: `Search: "${debouncedSearch}"`,
        clear: () => setSearch(""),
      });
    if (fBook)
      chips.push({
        key: "book",
        label: `Book: ${books.find((b) => b.value === fBook)?.label ?? fBook}`,
        clear: () => setFBook(""),
      });
    if (fSubject)
      chips.push({
        key: "subject",
        label: `Subject: ${subjectsList.find((s) => s.id === fSubject)?.title ?? fSubject}`,
        clear: () => setFSubject(""),
      });
    if (fChapter)
      chips.push({
        key: "chapter",
        label: `Topic: ${chapterOptions.find((c) => c.value === fChapter)?.label ?? fChapter}`,
        clear: () => setFChapter(""),
      });
    fTopicIds.forEach((id) =>
      chips.push({
        key: `topic-${id}`,
        label: `Subtopic: ${topicsList.find((t) => t.id === id)?.title ?? id}`,
        clear: () => setFTopicIds((v) => v.filter((x) => x !== id)),
      }),
    );
    fYears.forEach((y) =>
      chips.push({
        key: `year-${y}`,
        label: `Year: ${y}`,
        clear: () => setFYears((v) => v.filter((x) => x !== y)),
      }),
    );
    fSources.forEach((id) =>
      chips.push({
        key: `src-${id}`,
        label: `Source: ${sourcesList.find((s) => s.id === id)?.name ?? id}`,
        clear: () => setFSources((v) => v.filter((x) => x !== id)),
      }),
    );
    fDifficulties.forEach((d) =>
      chips.push({
        key: `diff-${d}`,
        label: `Difficulty: ${d}`,
        clear: () => setFDifficulties((v) => v.filter((x) => x !== d)),
      }),
    );
    fTags.forEach((t) =>
      chips.push({
        key: `tag-${t}`,
        label: `Tag: ${t}`,
        clear: () => setFTags((v) => v.filter((x) => x !== t)),
      }),
    );
    if (fStatus)
      chips.push({
        key: "status",
        label: `Status: ${fStatus}`,
        clear: () => setFStatus(""),
      });
    if (fPaid)
      chips.push({
        key: "paid",
        label: fPaid === "true" ? "Paid" : "Free",
        clear: () => setFPaid(""),
      });
    if (fAttribute)
      chips.push({
        key: "attr",
        label:
          ATTRIBUTE_OPTIONS.find((a) => a.value === fAttribute)?.label ??
          fAttribute,
        clear: () => setFAttribute(""),
      });
    return chips;
  }, [
    debouncedSearch,
    fBook,
    fSubject,
    fChapter,
    fTopicIds,
    fYears,
    fSources,
    fDifficulties,
    fTags,
    fStatus,
    fPaid,
    fAttribute,
    books,
    subjectsList,
    chapterOptions,
    topicsList,
    sourcesList,
  ]);

  const clearAllFilters = () => {
    setSearch("");
    setFBook("");
    setFSubject("");
    setFChapter("");
    setFTopicIds([]);
    setFYears([]);
    setFSources([]);
    setFDifficulties([]);
    setFTags([]);
    setFStatus("");
    setFPaid("");
    setFAttribute("");
    setPage(1);
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const result = await api.upload<{ url: string }>(
      "/admin/content/uploads/images",
      formData,
    );
    return result.url;
  };

  const openCreate = () => {
    setEditMcq(null);
    setForm({
      topicId: fTopicIds.length === 1 ? fTopicIds[0] : "",
      question: "",
      optA: "",
      optB: "",
      optC: "",
      optD: "",
      optE: "",
      correctAnswer: "A",
      explanation: "",
      explanationBlocks: parseExplanationToBlocks(""),
      explA: "",
      explB: "",
      explC: "",
      explD: "",
      explE: "",
      difficulty: "medium",
      references: "",
      tags: "",
      isPaid: false,
      year: fYears.length === 1 ? fYears[0] : "",
      sourceId: fSources.length === 1 ? fSources[0] : "",
      institutionId: "",
      questionType: "single_best",
      examType: "",
      isPublished: true,
      isArchived: false,
    });
    setNewSourceName("");
    setNewInstitutionName("");
    setShowForm(true);
    setError("");
  };

  const openEdit = (m: MCQRow) => {
    const opts = normalizeOptionsMap(m.options);
    const optExpls = normalizeOptionExplanationsMap(
      (m as any).optionExplanations,
    );
    setEditMcq(m);
    setForm({
      topicId: m.topicId,
      question: m.question,
      optA: opts.A || "",
      optB: opts.B || "",
      optC: opts.C || "",
      optD: opts.D || "",
      optE: opts.E || "",
      correctAnswer: m.correctAnswer,
      explanation: m.explanation || "",
      explanationBlocks: parseExplanationToBlocks(m.explanation),
      explA: optExpls.A || "",
      explB: optExpls.B || "",
      explC: optExpls.C || "",
      explD: optExpls.D || "",
      explE: optExpls.E || "",
      difficulty: m.difficulty,
      references: m.references || "",
      tags: Array.isArray(m.tags) ? m.tags.join(", ") : (m as any).tags || "",
      isPaid: m.isPaid ?? false,
      year: m.year ? String(m.year) : "",
      sourceId: m.sourceId || "",
      institutionId: m.institutionId || "",
      questionType: m.questionType || "single_best",
      examType: m.examType || "",
      isPublished: m.isPublished,
      isArchived: m.isArchived,
    });
    setNewSourceName("");
    setNewInstitutionName("");
    setShowForm(true);
    setError("");
  };

  const buildMcqPayload = () => {
    const options: Record<string, string> = {};
    if (form.optA) options.A = form.optA;
    if (form.optB) options.B = form.optB;
    if (form.optC) options.C = form.optC;
    if (form.optD) options.D = form.optD;
    if (form.optE) options.E = form.optE;

    const optionExplanations: Record<string, string> = {};
    if (form.explA) optionExplanations.A = form.explA;
    if (form.explB) optionExplanations.B = form.explB;
    if (form.explC) optionExplanations.C = form.explC;
    if (form.explD) optionExplanations.D = form.explD;
    if (form.explE) optionExplanations.E = form.explE;

    return {
      topicId: form.topicId,
      question: form.question,
      options,
      correctAnswer: form.correctAnswer,
      explanation:
        serializeBlocksToExplanation(form.explanationBlocks) || undefined,
      optionExplanations:
        Object.keys(optionExplanations).length > 0
          ? optionExplanations
          : undefined,
      difficulty: form.difficulty,
      references: form.references || undefined,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      isPublished: form.isPublished,
      isPaid: form.isPaid,
      year: form.year ? parseInt(form.year, 10) : null,
      sourceId: form.sourceId || null,
      institutionId: form.institutionId || null,
      questionType: form.questionType || null,
      examType: form.examType || null,
      isArchived: form.isArchived,
    };
  };

  const handleSave = async () => {
    if (!form.topicId || !form.question || !form.optA || !form.optB) {
      setError("Topic, question, and at least 2 options required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildMcqPayload();
      if (editMcq) {
        await api.put(`/admin/content/mcqs/${editMcq.id}`, payload);
      } else {
        await api.post("/admin/content/mcqs", payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: MCQRow) => {
    if (!confirm("Delete this MCQ?")) return;
    try {
      await api.delete(`/admin/content/mcqs/${m.id}`);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const togglePublish = async (m: MCQRow) => {
    try {
      await api.put(`/admin/content/mcqs/${m.id}`, {
        isPublished: !m.isPublished,
      });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleArchive = async (m: MCQRow) => {
    try {
      await api.put(`/admin/content/mcqs/${m.id}`, {
        isArchived: !m.isArchived,
      });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const quickCreateSource = async () => {
    const name = newSourceName.trim();
    if (!name) return;
    try {
      const s = await api.post<SourceRef>("/admin/content/sources", {
        name,
        kind: "custom",
      });
      setSources((prev) =>
        prev.some((p) => p.id === s.id) ? prev : [...prev, s],
      );
      setForm((f) => ({ ...f, sourceId: s.id }));
      setNewSourceName("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const quickCreateInstitution = async () => {
    const name = newInstitutionName.trim();
    if (!name) return;
    try {
      const i = await api.post<InstitutionRef>("/admin/content/institutions", {
        name,
      });
      setInstitutions((prev) =>
        prev.some((p) => p.id === i.id) ? prev : [...prev, i],
      );
      setForm((f) => ({ ...f, institutionId: i.id }));
      setNewInstitutionName("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Bulk actions ──
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelected((prev) => {
      const allSelected = mcqs.length > 0 && mcqs.every((m) => prev.has(m.id));
      const next = new Set(prev);
      mcqs.forEach((m) => (allSelected ? next.delete(m.id) : next.add(m.id)));
      return next;
    });
  };

  const runBulkUpdate = async (
    patch: Record<string, unknown>,
    successMsg?: string,
  ) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await api.post<{ count: number }>(
        "/admin/content/mcqs/bulk-update",
        {
          ids: Array.from(selected),
          patch,
        },
      );
      setSelected(new Set());
      await load();
      if (successMsg) alert(successMsg.replace("{n}", String(res.count)));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Bulk Import ──
  const resolveSourceByName = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = sourcesList.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const created = await api.post<SourceRef>("/admin/content/sources", {
      name: trimmed,
      kind: "custom",
    });
    setSources((prev) =>
      prev.some((p) => p.id === created.id) ? prev : [...prev, created],
    );
    return created.id;
  };

  const handleBulkImport = async () => {
    if (!importTopicId) {
      setImportResult("❌ Select a topic first");
      return;
    }
    setImporting(true);
    setImportResult("");
    try {
      let mcqList: any[] = [];

      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(importText);
        mcqList = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Parse as CSV: question,optA,optB,optC,optD,correct,explanation,difficulty[,year,source,tags(|)]
        const lines = importText
          .trim()
          .split("\n")
          .filter((l) => l.trim());
        const startIdx = lines[0]?.toLowerCase().includes("question") ? 1 : 0; // skip header
        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i]
            .split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((c) => c.replace(/^"|"$/g, "").trim());
          if (cols.length < 5) continue;
          mcqList.push({
            question: cols[0],
            options: { A: cols[1], B: cols[2], C: cols[3], D: cols[4] || "" },
            correctAnswer: cols[5] || "A",
            explanation: cols[6] || "",
            difficulty: cols[7] || "medium",
            ...(cols[8] ? { year: cols[8] } : {}),
            ...(cols[9] ? { source: cols[9] } : {}),
            ...(cols[10]
              ? {
                  tags: cols[10]
                    .split("|")
                    .map((t: string) => t.trim())
                    .filter(Boolean),
                }
              : {}),
          });
        }
      }

      if (mcqList.length === 0) {
        setImportResult("❌ No valid MCQs found");
        setImporting(false);
        return;
      }

      // Attach topicId, defaults, and normalize options
      const normalized: any[] = [];
      for (const m of mcqList) {
        const rawOpts = m.options || {
          A: m.optA,
          B: m.optB,
          C: m.optC,
          D: m.optD,
          E: m.optE,
        };
        const normalizedOpts = normalizeOptionsMap(rawOpts);
        const normalizedOptExpls = normalizeOptionExplanationsMap(
          m.optionExplanations || {
            A: m.explA,
            B: m.explB,
            C: m.explC,
            D: m.explD,
            E: m.explE,
          },
        );

        let sourceId: string | null = m.sourceId || null;
        const sourceName = typeof m.source === "string" ? m.source : "";
        if (sourceName) sourceId = await resolveSourceByName(sourceName);
        if (!sourceId && importSourceId) sourceId = importSourceId;

        const yearRaw = m.year ?? importYear;
        const yearNum =
          yearRaw !== "" && yearRaw != null && Number.isFinite(Number(yearRaw))
            ? parseInt(String(yearRaw), 10)
            : null;

        normalized.push({
          ...m,
          topicId: importTopicId,
          options: normalizedOpts,
          optionExplanations:
            Object.keys(normalizedOptExpls).length > 0
              ? normalizedOptExpls
              : undefined,
          correctAnswer: String(m.correctAnswer || m.correct || "A")
            .toUpperCase()
            .trim(),
          difficulty: m.difficulty || "medium",
          year: yearNum,
          sourceId,
          tags: Array.isArray(m.tags)
            ? m.tags
            : typeof m.tags === "string" && m.tags
              ? m.tags
                  .split(",")
                  .map((t: string) => t.trim())
                  .filter(Boolean)
              : undefined,
          isPublished: m.isPublished !== undefined ? m.isPublished : true,
        });
      }

      const res = await api.post<{ count: number }>(
        "/admin/content/mcqs/bulk",
        { mcqs: normalized },
      );
      setImportResult(`✅ Successfully imported ${res.count} MCQs!`);
      setImportText("");
      load();
    } catch (err: any) {
      setImportResult(`❌ Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusBadge = (m: MCQRow) => {
    if (m.isArchived)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          Archived
        </span>
      );
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
      >
        {m.isPublished ? "Published" : "Draft"}
      </span>
    );
  };

  if (loading && mcqs.length === 0)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCQs</h1>
          <p className="text-gray-500 mt-1">
            {total} questions
            {activeFilters.length > 0 ? " matching filters" : " total"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowImport(true);
              setImportResult("");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium"
          >
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Add MCQ
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question, reference, tag, topic, source…"
              className="w-full pl-9 pr-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
            />
          </div>
          <select
            value={fSort}
            onChange={(e) => {
              setFSort(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            title="Sort order"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={fBook}
            onChange={(e) => {
              setFBook(e.target.value);
              setFSubject("");
              setFChapter("");
              setFTopicIds([]);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Books</option>
            {books.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <select
            value={fSubject}
            onChange={(e) => {
              setFSubject(e.target.value);
              setFChapter("");
              setFTopicIds([]);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Subjects</option>
            {subjectsList
              .filter((s) => !fBook || s.bookId === fBook)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
          <select
            value={fChapter}
            onChange={(e) => {
              setFChapter(e.target.value);
              setFTopicIds([]);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">All Topics</option>
            {chapterOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <MultiSelect
            label="Subtopics"
            options={subtopicOptions}
            values={fTopicIds}
            onChange={(v) => {
              setFTopicIds(v);
              setPage(1);
            }}
            searchable
            className="min-w-[140px]"
          />
          <MultiSelect
            label="Years"
            options={yearOptions}
            values={fYears}
            onChange={(v) => {
              setFYears(v);
              setPage(1);
            }}
            className="min-w-[110px]"
          />
          <MultiSelect
            label="Sources"
            options={sourceOptions}
            values={fSources}
            onChange={(v) => {
              setFSources(v);
              setPage(1);
            }}
            searchable
            className="min-w-[130px]"
          />
          <MultiSelect
            label="Difficulty"
            options={[
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
            ]}
            values={fDifficulties}
            onChange={(v) => {
              setFDifficulties(v);
              setPage(1);
            }}
            className="min-w-[120px]"
          />
          <MultiSelect
            label="Tags"
            options={tagOptions}
            values={fTags}
            onChange={(v) => {
              setFTags(v);
              setPage(1);
            }}
            searchable
            className="min-w-[110px]"
          />
          <select
            value={fStatus}
            onChange={(e) => {
              setFStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Any Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={fPaid}
            onChange={(e) => {
              setFPaid(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Any Access</option>
            <option value="false">Free</option>
            <option value="true">Paid</option>
          </select>
          <select
            value={fAttribute}
            onChange={(e) => {
              setFAttribute(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:primary-500 outline-none"
          >
            {ATTRIBUTE_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-50">
            {activeFilters.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.clear}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium hover:bg-primary-100 transition-colors"
                title="Remove filter"
              >
                {chip.label}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="sticky top-14 z-20 bg-gray-900 text-white rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-sm font-semibold mr-2">
            {selected.size} selected
          </span>
          <select
            value={bulkYear}
            onChange={(e) => setBulkYear(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-sm bg-white text-gray-900 outline-none"
          >
            <option value="">Year…</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            disabled={!bulkYear || bulkBusy}
            onClick={() =>
              runBulkUpdate(
                { year: parseInt(bulkYear, 10) },
                "Assigned year to {n} MCQs",
              )
            }
            className="px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 font-medium"
          >
            Apply Year
          </button>
          <select
            value={bulkSource}
            onChange={(e) => setBulkSource(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-sm bg-white text-gray-900 outline-none max-w-[160px]"
          >
            <option value="">Source…</option>
            {sourcesList
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <button
            disabled={!bulkSource || bulkBusy}
            onClick={() =>
              runBulkUpdate(
                { sourceId: bulkSource },
                "Assigned source to {n} MCQs",
              )
            }
            className="px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 font-medium"
          >
            Apply Source
          </button>
          <input
            value={bulkTags}
            onChange={(e) => setBulkTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="px-2 py-1.5 rounded-lg text-sm bg-white text-gray-900 outline-none w-44"
          />
          <button
            disabled={!bulkTags.trim() || bulkBusy}
            onClick={() =>
              runBulkUpdate(
                {
                  addTags: bulkTags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
                "Tagged {n} MCQs",
              )
            }
            className="px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 font-medium"
          >
            Add Tags
          </button>
          <span className="flex-1" />
          <button
            disabled={bulkBusy}
            onClick={() =>
              runBulkUpdate({ isPublished: true }, "Published {n} MCQs")
            }
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-40 font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Publish
          </button>
          <button
            disabled={bulkBusy}
            onClick={() =>
              runBulkUpdate({ isPublished: false }, "Moved {n} MCQs to draft")
            }
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-500/90 hover:bg-gray-500 disabled:opacity-40 font-medium"
          >
            Draft
          </button>
          <button
            disabled={bulkBusy}
            onClick={() =>
              runBulkUpdate({ isArchived: true }, "Archived {n} MCQs")
            }
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-purple-500/90 hover:bg-purple-500 disabled:opacity-40 font-medium"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
          <button
            disabled={bulkBusy}
            onClick={() =>
              runBulkUpdate({ isArchived: false }, "Restored {n} MCQs")
            }
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 disabled:opacity-40 font-medium"
          >
            <ArchiveRestore className="w-3.5 h-3.5" /> Unarchive
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-2 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* MCQ Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {editMcq
                  ? `Edit MCQ${editMcq.seq ? ` · position #${editMcq.seq}` : ""}`
                  : "Create MCQ"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl mb-4 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            {editMcq && (
              <p className="text-xs text-gray-400 -mt-2 mb-3">
                Editing keeps this question at its original position #
                {editMcq.seq}.
              </p>
            )}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtopic *
                </label>
                <select
                  value={form.topicId}
                  onChange={(e) =>
                    setForm({ ...form, topicId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Select topic…</option>
                  <TopicGroupOptions
                    groups={topicsByChapter}
                    showBook={books.length > 1}
                  />
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question *
                </label>
                <textarea
                  value={form.question}
                  onChange={(e) =>
                    setForm({ ...form, question: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none text-sm"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={(e) =>
                    setForm({ ...form, isPaid: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Paid Question (Requires Premium Subscription)
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    If checked, users must have an active premium subscription
                    to attempt or view this question.
                  </span>
                </span>
              </label>
              {["A", "B", "C", "D", "E"].map((opt) => (
                <div key={opt} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Option {opt} {opt <= "B" ? "*" : ""}
                    </label>
                    <input
                      value={(form as any)[`opt${opt}`]}
                      onChange={(e) =>
                        setForm({ ...form, [`opt${opt}`]: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Explanation {opt}
                    </label>
                    <input
                      value={(form as any)[`expl${opt}`]}
                      onChange={(e) =>
                        setForm({ ...form, [`expl${opt}`]: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="Why this is right/wrong"
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correct Answer *
                  </label>
                  <select
                    value={form.correctAnswer}
                    onChange={(e) =>
                      setForm({ ...form, correctAnswer: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {["A", "B", "C", "D", "E"].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({ ...form, difficulty: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Classification */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Classification
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year
                    </label>
                    <select
                      value={form.year}
                      onChange={(e) =>
                        setForm({ ...form, year: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">— None —</option>
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Type
                    </label>
                    <select
                      value={form.questionType}
                      onChange={(e) =>
                        setForm({ ...form, questionType: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      {QUESTION_TYPES.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference / Source
                  </label>
                  <select
                    value={form.sourceId}
                    onChange={(e) =>
                      setForm({ ...form, sourceId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">— None —</option>
                    {sourcesList
                      .filter((s) => s.isActive || s.id === form.sourceId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="Quick-create source (e.g., Guyton Ch. 9)"
                      className="flex-1 px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={quickCreateSource}
                      disabled={!newSourceName.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Institution / University
                    </label>
                    <select
                      value={form.institutionId}
                      onChange={(e) =>
                        setForm({ ...form, institutionId: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">— None —</option>
                      {institutionsList
                        .filter(
                          (i) => i.isActive || i.id === form.institutionId,
                        )
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2 mt-1.5">
                      <input
                        value={newInstitutionName}
                        onChange={(e) => setNewInstitutionName(e.target.value)}
                        placeholder="Quick-create institution"
                        className="flex-1 px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={quickCreateInstitution}
                        disabled={!newInstitutionName.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exam / Test Type
                    </label>
                    <input
                      value={form.examType}
                      onChange={(e) =>
                        setForm({ ...form, examType: e.target.value })
                      }
                      list="exam-type-options"
                      placeholder="e.g., Final, Midterm, Board"
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <datalist id="exam-type-options">
                      {facets.examTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={
                        form.isArchived
                          ? "archived"
                          : form.isPublished
                            ? "published"
                            : "draft"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({
                          ...form,
                          isArchived: v === "archived",
                          isPublished: v === "published",
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">
                  General Explanation (Rich Text / Tables / Diagrams / Formulas
                  / Images)
                </label>
                <BlockEditor
                  blocks={form.explanationBlocks}
                  onChange={(blocks) =>
                    setForm((prev) => ({ ...prev, explanationBlocks: blocks }))
                  }
                  uploadImage={uploadImage}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    References
                  </label>
                  <input
                    value={form.references}
                    onChange={(e) =>
                      setForm({ ...form, references: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="e.g., hypertension, pregnancy"
                    list="tag-suggestions"
                  />
                  <datalist id="tag-suggestions">
                    {facets.tags.map((t) => (
                      <option key={t.tag} value={t.tag} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving…" : editMcq ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImport(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Bulk Import MCQs</h2>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Subtopic *
                  </label>
                  <select
                    value={importTopicId}
                    onChange={(e) => setImportTopicId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select topic…</option>
                    <TopicGroupOptions
                      groups={topicsByChapter}
                      showBook={books.length > 1}
                    />
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Year
                  </label>
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">— None —</option>
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Source
                  </label>
                  <select
                    value={importSourceId}
                    onChange={(e) => setImportSourceId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">— None —</option>
                    {sourcesList
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paste CSV or JSON
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none font-mono"
                  placeholder={`CSV format:\nquestion,optA,optB,optC,optD,correctAnswer,explanation,difficulty,year,source,tags\n"What is X?","Answer A","Answer B","Answer C","Answer D","A","Because...","medium",2024,"Guyton Ch. 7","High Yield|Clinical"\n\nOR JSON format:\n[{"question":"What is X?","options":{"A":"...","B":"...","C":"...","D":"..."},"correctAnswer":"A","year":2024,"source":"University Past Paper","tags":["High Yield"]}]`}
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl text-sm text-blue-700">
                <p className="font-medium mb-1">Supported Formats:</p>
                <p>
                  • <strong>CSV</strong>: question, optA, optB, optC, optD,
                  correct, explanation, difficulty,{" "}
                  <strong>year, source, tags</strong> (tags separated by |)
                </p>
                <p>
                  • <strong>JSON</strong>: objects with question, options,
                  correctAnswer, year, source (name) or sourceId, tags
                </p>
                <p>
                  • Tab-separated values also supported. Unknown source names
                  are created automatically.
                </p>
                <p>
                  • Default Year/Source above apply to rows without their own
                  values.
                </p>
              </div>

              {importResult && (
                <div
                  className={`p-3 rounded-xl text-sm ${importResult.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                >
                  {importResult}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={importing || !importText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCQ Preview Modal */}
      {previewMcq &&
        (() => {
          const opts = normalizeOptionsMap(previewMcq.options);
          const optExpls = normalizeOptionExplanationsMap(
            (previewMcq as any).optionExplanations,
          );
          const explanationBlocks = parseExplanationToBlocks(
            previewMcq.explanation,
          );
          const topicRef = topicsList.find((t) => t.id === previewMcq.topicId);
          const rawTags = previewMcq.tags as unknown;
          const tags = Array.isArray(rawTags)
            ? rawTags
            : typeof rawTags === "string" && rawTags
              ? rawTags
                  .split(",")
                  .map((t: string) => t.trim())
                  .filter(Boolean)
              : [];
          const references = previewMcq.references;

          return (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setPreviewMcq(null)}
            >
              <div
                className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8 flex flex-col max-h-[88vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-4 border-b border-gray-100 flex-shrink-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        MCQ Preview · #{previewMcq.seq}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${previewMcq.isPaid ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
                      >
                        {previewMcq.isPaid ? "Paid" : "Free"}
                      </span>
                      {statusBadge(previewMcq)}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${previewMcq.difficulty === "easy" ? "bg-blue-100 text-blue-700" : previewMcq.difficulty === "hard" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {previewMcq.difficulty}
                      </span>
                      {previewMcq.year && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {previewMcq.year}
                        </span>
                      )}
                      {previewMcq.subjectName && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {previewMcq.subjectName}
                        </span>
                      )}
                      {previewMcq.sourceName && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 max-w-[220px] truncate"
                          title={previewMcq.sourceName}
                        >
                          {previewMcq.sourceName}
                        </span>
                      )}
                    </div>
                    {topicRef && (
                      <p className="text-xs text-gray-500">
                        {topicRef.bookTitle} ›{" "}
                        {topicRef.subjectTitle
                          ? `${topicRef.subjectTitle} › `
                          : ""}
                        {topicRef.chapterTitle} ›{" "}
                        <span className="font-medium text-gray-700">
                          {topicRef.title}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewMcq(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="space-y-6 overflow-y-auto py-4 pr-1 flex-1">
                  {/* Question */}
                  <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                      Question
                    </span>
                    <p className="text-base font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                      {previewMcq.question}
                    </p>
                  </div>

                  {/* Options List */}
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2.5">
                      Options & Explanations
                    </span>
                    <div className="space-y-2.5">
                      {["A", "B", "C", "D", "E"].map((key) => {
                        const optText = opts[key];
                        if (!optText) return null;
                        const isCorrect = previewMcq.correctAnswer === key;
                        const expl = optExpls[key];

                        return (
                          <div
                            key={key}
                            className={`rounded-xl border p-3 transition-all ${
                              isCorrect
                                ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/50"
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {key}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={`text-sm ${isCorrect ? "font-semibold text-emerald-950" : "text-gray-800"}`}
                                  >
                                    {optText}
                                  </p>
                                  {isCorrect && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                      <Check className="w-3.5 h-3.5" /> Correct
                                      Answer
                                    </span>
                                  )}
                                </div>
                                {expl && (
                                  <div className="mt-2 text-xs text-gray-600 bg-gray-50/90 rounded-lg p-2 border border-gray-100">
                                    <span className="font-semibold text-gray-700">
                                      Option {key} Explanation:{" "}
                                    </span>
                                    {expl}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* General Explanation */}
                  {explanationBlocks.some(
                    (b) => b.content && b.content.trim(),
                  ) && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                        General Explanation
                      </span>
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
                        {explanationBlocks.map((b) => {
                          if (!b.content || !b.content.trim()) return null;
                          if (b.type === "image") {
                            return (
                              <div key={b.id} className="text-center my-2">
                                <img
                                  src={b.content}
                                  alt="Explanation diagram"
                                  className="max-h-72 max-w-full rounded-lg border border-gray-200 shadow-sm mx-auto object-contain"
                                />
                              </div>
                            );
                          }
                          if (b.type === "callout") {
                            return (
                              <div
                                key={b.id}
                                className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-sm text-amber-900"
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: b.content,
                                  }}
                                />
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: b.content }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* References & Tags */}
                  {(references || (tags && tags.length > 0)) && (
                    <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {references && (
                        <div>
                          <span className="font-semibold text-gray-500 block mb-0.5">
                            References:
                          </span>
                          <p className="text-gray-700">{references}</p>
                        </div>
                      )}
                      {tags && tags.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-500 block mb-1">
                            Tags:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {tags.map((t: string, idx: number) => (
                              <span
                                key={idx}
                                className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[11px]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 flex-shrink-0 mt-2">
                  <button
                    onClick={() => {
                      const target = previewMcq;
                      setPreviewMcq(null);
                      openEdit(target);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit this MCQ
                  </button>
                  <button
                    onClick={() => setPreviewMcq(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Select-all row */}
      {mcqs.length > 0 && (
        <label className="flex items-center gap-2 px-1 text-sm text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mcqs.length > 0 && mcqs.every((m) => selected.has(m.id))}
            onChange={selectAllOnPage}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Select all on this page
        </label>
      )}

      {/* MCQ List */}
      {mcqs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No MCQs found</p>
          {activeFilters.length > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mcqs.map((m) => {
            const opts = normalizeOptionsMap(m.options);
            const optKeys = Object.keys(opts);
            return (
              <div
                key={m.id}
                className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all ${selected.has(m.id) ? "border-primary-300 ring-1 ring-primary-200" : "border-gray-100"}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleSelect(m.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-gray-400 tabular-nums">
                        #{m.seq}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.isPaid ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
                      >
                        {m.isPaid ? "Paid" : "Free"}
                      </span>
                      {statusBadge(m)}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.difficulty === "easy" ? "bg-blue-100 text-blue-700" : m.difficulty === "hard" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {m.difficulty}
                      </span>
                      {m.year && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {m.year}
                        </span>
                      )}
                      {m.subjectName && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {m.subjectName}
                        </span>
                      )}
                      {m.sourceName && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 max-w-[240px] truncate"
                          title={m.sourceName}
                        >
                          {m.sourceName}
                        </span>
                      )}
                      {m.attempts > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500"
                          title={`${m.correct}/${m.attempts} correct`}
                        >
                          {Math.round((m.correct / m.attempts) * 100)}% ·{" "}
                          {m.attempts} tries
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {m.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Correct: {m.correctAnswer} • Options:{" "}
                      {optKeys.length > 0 ? optKeys.join(", ") : "None"}
                      {m.topicTitle
                        ? ` • ${m.chapterTitle ?? ""} › ${m.topicTitle}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPreviewMcq(m)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Preview MCQ"
                      aria-label="Preview MCQ"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => togglePublish(m)}
                      className={`p-2 rounded-lg transition-colors ${
                        m.isPublished
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                      title={
                        m.isPublished
                          ? "Published — Click to make Draft"
                          : "Draft — Click to Publish"
                      }
                      aria-label={
                        m.isPublished
                          ? "Published — Click to make Draft"
                          : "Draft — Click to Publish"
                      }
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleArchive(m)}
                      className={`p-2 rounded-lg transition-colors ${
                        m.isArchived
                          ? "text-purple-600 hover:bg-purple-50"
                          : "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                      }`}
                      title={
                        m.isArchived ? "Archived — Click to restore" : "Archive"
                      }
                      aria-label={
                        m.isArchived ? "Unarchive MCQ" : "Archive MCQ"
                      }
                    >
                      {m.isArchived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(m)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit MCQ"
                      aria-label="Edit MCQ"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete MCQ"
                      aria-label="Delete MCQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 bg-white"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 bg-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
