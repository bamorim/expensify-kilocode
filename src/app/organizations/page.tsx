import { OrganizationForm } from "~/app/_components/organization-form";
import { OrganizationList } from "~/app/_components/organization-list";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function OrganizationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="mt-2 text-gray-600">
            Create and manage your organizations. Switch between organizations to work with different teams.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Your Organizations</h2>
            <OrganizationList />
          </div>
          
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Create New Organization</h2>
            <OrganizationForm />
          </div>
        </div>
      </div>
    </div>
  );
}