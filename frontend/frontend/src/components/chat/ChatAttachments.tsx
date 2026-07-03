import { getMediaUrl } from "../../utils/chatHelpers";

interface Attachment {
  url: string;
  name: string;
  mime?: string;
}

export default function ChatAttachments({
  attachments,
  mine,
}: {
  attachments?: Attachment[];
  mine?: boolean;
}) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((file, index) => {
        const url = getMediaUrl(file.url);
        const isImage = (file.mime || "").startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
        if (isImage) {
          return (
            <a key={`${file.url}-${index}`} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={file.name}
                className="max-h-44 max-w-full rounded-xl border border-white/10"
              />
            </a>
          );
        }
        return (
          <a
            key={`${file.url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex rounded-lg px-2 py-1 text-xs underline ${mine ? "text-blue-100" : "text-violet-300"}`}
          >
            {file.name}
          </a>
        );
      })}
    </div>
  );
}
