import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";

export default function Profile() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/users/me"],
  });

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{user.username}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full">
              Edit Profile
            </Button>
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
            <Button variant="destructive" className="w-full">
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
