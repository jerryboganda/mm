import React, { useState } from "react";
import { Lock, Eye, EyeOff, FileText, CheckCircle2 } from "lucide-react";
import ResponsiveBookDocumentPreview from "./ResponsiveBookDocumentPreview";

interface ImportedDocumentBlockProps {
  block: {
    id: string;
    content: string;
    order: number;
    contentType?: string;
  };
  topicId: string;
}

export default function ImportedDocumentBlock({
  block,
  topicId,
}: ImportedDocumentBlockProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                Authoritative Book Document Block #{block.order}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                Immutable Parity Protected
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Compiled directly from Dr. Farzana Muneer's textbook DOCX. Direct manual edits are locked to maintain 100% textbook layout and content parity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewTheme(prev => prev === "light" ? "dark" : "light")}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Theme: {previewTheme}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(prev => !prev)}
            className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1.5"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="pt-2">
          <ResponsiveBookDocumentPreview
            content={block.content}
            topicId={topicId}
            theme={previewTheme}
          />
        </div>
      )}
    </div>
  );
}
