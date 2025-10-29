export function Injectable(): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) => {
    // This is a simple decorator for dependency injection
    // In a real application, you might use a DI framework
    return target;
  };
}
