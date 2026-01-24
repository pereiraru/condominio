import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    unitId: string | null;
    unitCode?: string;
    ownerId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      unitId: string | null;
      unitCode?: string;
      ownerId?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    unitId: string | null;
    unitCode?: string;
    ownerId?: string | null;
  }
}
