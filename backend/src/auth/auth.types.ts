export type UserRole = "USER" | "ADMIN";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}
