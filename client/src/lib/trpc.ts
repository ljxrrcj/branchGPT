import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@branchgpt/shared';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '/api';
  }
  // SSR should use localhost
  return 'http://localhost:3000/api';
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
    }),
  ],
});
