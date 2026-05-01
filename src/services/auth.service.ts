import { env } from "../config/env";

export function loginAdmin(email: string) {
  return {
    accessToken: env.adminToken,
    user: {
      id: "admin-01",
      email,
      name: "Admin WFC Jogja",
      role: "admin",
    },
  };
}
