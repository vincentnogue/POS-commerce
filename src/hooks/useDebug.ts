export function useDebug(label: string, value: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${label}]`, value);
  }
}
