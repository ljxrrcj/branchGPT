import { createTRPCReact, httpBatchLink } from '@trpc/react-query';

// Using 'any' as placeholder until proper router types are exported from server
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '/api';
  }
  // SSR should use localhost
  return 'http://localhost:3000/api';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpcClient = (trpc as any).createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
    }),
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TRPCProvider = (trpc as any).Provider;
