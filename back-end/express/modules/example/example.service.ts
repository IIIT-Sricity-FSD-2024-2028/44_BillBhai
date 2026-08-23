import {
  CreateExampleDto,
  ExampleItem,
  UpdateExampleDto,
} from './example.schema';

/**
 * Example Module Service
 *
 * Responsibilities:
 * - Encapsulates all domain and business logic.
 * - Handles data persistence, retrieval, and transformations.
 * - Framework agnostic: does NOT accept Express Request or Response objects.
 */
export class ExampleService {
  private items: ExampleItem[] = [
    {
      id: 'EX-001',
      name: 'Sample Item 1',
      description: 'Initial template sample item',
      createdAt: new Date().toISOString(),
    },
  ];
  private counter = 2;

  public findAll(): ExampleItem[] {
    return [...this.items];
  }

  public findById(id: string): ExampleItem | null {
    const item = this.items.find((i) => i.id === id);
    return item ? { ...item } : null;
  }

  public create(dto: CreateExampleDto): ExampleItem {
    const newItem: ExampleItem = {
      id: `EX-${String(this.counter++).padStart(3, '0')}`,
      name: dto.name,
      description: dto.description,
      createdAt: new Date().toISOString(),
    };
    this.items.push(newItem);
    return { ...newItem };
  }

  public update(id: string, dto: UpdateExampleDto): ExampleItem | null {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) {
      return null;
    }
    this.items[index] = {
      ...this.items[index],
      ...dto,
    };
    return { ...this.items[index] };
  }

  public remove(id: string): boolean {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }
}

export const exampleService = new ExampleService();
