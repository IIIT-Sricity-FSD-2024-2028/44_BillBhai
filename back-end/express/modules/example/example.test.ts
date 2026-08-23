import { ExampleService } from './example.service';

/**
 * Example Module Unit Tests Skeleton
 *
 * Responsibilities:
 * - Tests module service logic independently from HTTP.
 * - Tests controller or route behavior where appropriate.
 */
describe('ExampleModule - ExampleService', () => {
  let service: ExampleService;

  beforeEach(() => {
    service = new ExampleService();
  });

  it('should return initial items on findAll', () => {
    const items = service.findAll();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should create a new item with unique ID', () => {
    const created = service.create({
      name: 'Test Item',
      description: 'Test Description',
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Test Item');

    const found = service.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test Item');
  });

  it('should return null when item is not found', () => {
    const notFound = service.findById('non-existent-id');
    expect(notFound).toBeNull();
  });
});
