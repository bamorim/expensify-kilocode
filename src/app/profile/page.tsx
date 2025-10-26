import { UserProfile } from "~/app/_components/user-profile";
import { HydrateClient } from "~/trpc/server";

export default async function ProfilePage() {
  return (
    <HydrateClient>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">User Profile</h2>
          <p className="mt-2 text-gray-600">
            View your profile information and organization memberships.
          </p>
        </div>

        <UserProfile />
      </div>
    </HydrateClient>
  );
}