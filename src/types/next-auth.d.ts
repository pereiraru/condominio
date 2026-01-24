import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    unitId: string | null;
    unitCode?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      unitId: string | null;
      unitCode?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    unitId: string | null;
    unitCode?: string;
  }
}
