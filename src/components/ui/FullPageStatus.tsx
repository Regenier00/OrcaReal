export function FullPageStatus({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="grid min-h-svh place-items-center bg-paper px-5 text-center">
      <div>
        <p className="font-display text-xl font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-2 max-w-md text-sm text-mist">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
