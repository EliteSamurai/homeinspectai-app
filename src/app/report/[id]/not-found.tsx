import Link from "next/link";

export default function ReportNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Report Not Found</h1>
      <p className="mt-3 text-slate-600">This report link is invalid or has expired</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Analyze your own report →
      </Link>
    </main>
  );
}
