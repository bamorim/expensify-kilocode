import { OrganizationInfo } from "~/app/_components/organization-info";
import { OrganizationMembers } from "~/app/_components/organization-members";
import { auth } from "~/server/auth";
import { redirect, notFound } from "next/navigation";
import { api, HydrateClient } from "~/trpc/server";

interface OrganizationPageProps {
  params: {
    id: string;
  };
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Prefetch organization data
  void api.organization.get.prefetch({ id: params.id });
  void api.organization.getMembers.prefetch({ organizationId: params.id });

  return (
    <HydrateClient>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Organization Details</h1>
            <p className="mt-2 text-gray-600">
              View and manage your organization details and members.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-800">Organization Information</h2>
              <OrganizationInfo organizationId={params.id} />
            </div>
            
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-800">Organization Members</h2>
              <OrganizationMembers organizationId={params.id} />
            </div>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}