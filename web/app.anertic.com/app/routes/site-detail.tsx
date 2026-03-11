import { useParams } from "react-router"

export default function SiteDetail() {
  const { siteId } = useParams()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site Details</h1>
        <p className="text-sm text-muted-foreground">
          Site ID: {siteId}
        </p>
      </div>
    </div>
  )
}
