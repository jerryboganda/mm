import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";
import { AlertCircle, Play, Copy, ChevronDown } from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  flowchart: { curve: "basis", htmlLabels: true, padding: 15 },
  themeVariables: {
    primaryColor: "#6C63FF",
    primaryTextColor: "#fff",
    primaryBorderColor: "#5A52D5",
    lineColor: "#6C63FF",
    secondaryColor: "#F0EEFF",
    tertiaryColor: "#FFF8E1",
  },
});

interface MermaidEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const FLOWCHART_TEMPLATES: {
  name: string;
  description: string;
  code: string;
}[] = [
  {
    name: "Simple Flowchart",
    description: "Linear process with decision",
    code: `flowchart TD
    A[Start] --> B{Decision?}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  },
  {
    name: "Clinical Pathway",
    description: "Patient assessment flowchart",
    code: `flowchart TD
    A["Patient Presents\\nwith Symptoms"] --> B{"Initial\\nAssessment"}
    B -->|"Stable"| C["Outpatient\\nManagement"]
    B -->|"Unstable"| D["Emergency\\nIntervention"]
    C --> E{"Follow-up\\nImproved?"}
    E -->|"Yes"| F["Continue\\nTreatment"]
    E -->|"No"| G["Reassess &\\nEscalate"]
    D --> H["Stabilize"] --> I["Admit"]
    G --> D
    style A fill:#6C63FF,color:#fff
    style D fill:#EF4444,color:#fff
    style F fill:#22C55E,color:#fff`,
  },
  {
    name: "Diagnostic Algorithm",
    description: "Step-by-step diagnosis",
    code: `flowchart TD
    A["Presenting\\nComplaint"] --> B["History &\\nExamination"]
    B --> C{"Lab Tests\\nNormal?"}
    C -->|"Yes"| D["Reassure &\\nFollow-up"]
    C -->|"No"| E["Further\\nInvestigation"]
    E --> F{"Imaging\\nFindings?"}
    F -->|"Positive"| G["Diagnosis\\nConfirmed"]
    F -->|"Negative"| H["Consider\\nDifferentials"]
    G --> I["Start\\nTreatment"]
    H --> J["Specialist\\nReferral"]
    style G fill:#22C55E,color:#fff
    style J fill:#F59E0B,color:#fff`,
  },
  {
    name: "Treatment Protocol",
    description: "Treatment decision tree",
    code: `flowchart LR
    A["Condition\\nIdentified"] --> B{"Severity?"}
    B -->|"Mild"| C["Conservative\\nManagement"]
    B -->|"Moderate"| D["Medical\\nTherapy"]
    B -->|"Severe"| E["Surgical\\nIntervention"]
    C --> F{"Response?"}
    D --> F
    F -->|"Good"| G["Continue &\\nMonitor"]
    F -->|"Poor"| E
    E --> H["Post-op\\nCare"]
    style E fill:#EF4444,color:#fff
    style G fill:#22C55E,color:#fff`,
  },
  {
    name: "Obstetric Emergency",
    description: "Emergency response flowchart",
    code: `flowchart TD
    A["🚨 Emergency\\nPresentation"] --> B["ABCDE\\nAssessment"]
    B --> C{"Hemodynamically\\nStable?"}
    C -->|"No"| D["Resuscitate\\n• IV Access\\n• Fluids\\n• Blood"]
    C -->|"Yes"| E["Targeted\\nAssessment"]
    D --> F["Identify\\nCause"]
    E --> F
    F --> G{"Cause?"}
    G -->|"PPH"| H["Uterotonic\\nProtocol"]
    G -->|"Eclampsia"| I["MgSO4 +\\nAntihypertensives"]
    G -->|"Sepsis"| J["Antibiotics +\\nSepsis Bundle"]
    H --> K["Monitor\\n& Reassess"]
    I --> K
    J --> K
    style A fill:#EF4444,color:#fff
    style D fill:#F59E0B,color:#fff
    style K fill:#22C55E,color:#fff`,
  },
];

export default function MermaidEditor({
  content,
  onChange,
}: MermaidEditorProps) {
  const [code, setCode] = useState(content || FLOWCHART_TEMPLATES[0].code);
  const [svgOutput, setSvgOutput] = useState("");
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const renderDiagram = useCallback(async (mermaidCode: string) => {
    if (!mermaidCode.trim()) {
      setSvgOutput("");
      setError("");
      return;
    }
    try {
      const id = `mermaid-preview-${idCounter.current++}`;
      const { svg } = await mermaid.render(id, mermaidCode.trim());
      setSvgOutput(svg);
      setError("");
    } catch (err: any) {
      setError(err.message || "Invalid diagram syntax");
      setSvgOutput("");
    }
  }, []);

  // Initial render
  useEffect(() => {
    renderDiagram(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close templates dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        templateRef.current &&
        !templateRef.current.contains(e.target as Node)
      ) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onChange(newCode);
  };

  const handleRender = () => {
    renderDiagram(code);
  };

  const handleTemplateSelect = (templateCode: string) => {
    setCode(templateCode);
    onChange(templateCode);
    setShowTemplates(false);
    renderDiagram(templateCode);
  };

  const copyToClipboard = () => {
    navigator.clipboard?.writeText(code);
  };

  return (
    <div className="flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
            Mermaid Diagram
          </span>
        </div>
        <div className="flex-1" />

        {/* Templates dropdown */}
        <div className="relative" ref={templateRef}>
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Templates <ChevronDown className="w-3 h-3" />
          </button>
          {showTemplates && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-72">
              <div className="p-2">
                <p className="text-xs font-medium text-purple-500 uppercase tracking-wider mb-1.5 px-1">
                  Flowchart Templates
                </p>
                {FLOWCHART_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleTemplateSelect(t.code)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-50 flex items-start gap-2"
                  >
                    <span className="text-purple-400 mt-0.5">▸</span>
                    <span>
                      <span className="text-sm font-medium text-gray-800">
                        {t.name}
                      </span>
                      <br />
                      <span className="text-xs text-gray-400">
                        {t.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={copyToClipboard}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          title="Copy code"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button
          type="button"
          onClick={handleRender}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <Play className="w-3 h-3" /> Render
        </button>
      </div>

      {/* Split: Code Editor + Preview */}
      <div
        className="grid grid-cols-2 divide-x divide-gray-200"
        style={{ minHeight: "300px" }}
      >
        {/* Code editor */}
        <div className="flex flex-col">
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onBlur={handleRender}
            className="flex-1 p-3 font-mono text-sm text-gray-800 resize-none outline-none bg-gray-50"
            placeholder="Enter Mermaid diagram code..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <div className="px-2 py-1 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Preview
            </span>
          </div>
          <div
            className="flex-1 p-3 overflow-auto flex items-center justify-center"
            ref={previewRef}
          >
            {error ? (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            ) : svgOutput ? (
              <div
                dangerouslySetInnerHTML={{ __html: svgOutput }}
                className="mermaid-preview [&_svg]:max-w-full [&_svg]:h-auto"
              />
            ) : (
              <span className="text-xs text-gray-400">
                Click "Render" to preview
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
        <strong>Tip:</strong> Use{" "}
        <code className="bg-gray-200 px-1 rounded">--&gt;</code> for arrows,
        <code className="bg-gray-200 px-1 rounded ml-1">{"{ }"}</code> for
        diamonds (decisions),
        <code className="bg-gray-200 px-1 rounded ml-1">[ ]</code> for boxes,
        <code className="bg-gray-200 px-1 rounded ml-1">( )</code> for rounded
        boxes. Use{" "}
        <code className="bg-gray-200 px-1 rounded ml-1">|label|</code> on arrows
        for labels.
        <a
          href="https://mermaid.js.org/syntax/flowchart.html"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-purple-500 hover:underline"
        >
          Full syntax reference →
        </a>
      </div>
    </div>
  );
}
