export function Injectable(): ClassDecorator {
  return (target: any) => {
    // This is a simple decorator for dependency injection
    // In a real application, you might use a DI framework
    return target;
  };
}