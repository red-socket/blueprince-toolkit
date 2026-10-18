import type { Tier } from '../../spoilers';

export type Shape = 'dead' | 'straight' | 'L' | 'T' | 'cross';
export type Side = 'N' | 'E' | 'S' | 'W';
export type Category = 'Blueprint' | 'Bedroom' | 'Hallway' | 'Green Room' | 'Shop' | 'Red Room' | 'Blackprint';

export interface RoomData {
  name: string;
  cost: number; // gems
  rarity: number | null; // 1 commonplace .. 4 rare; null for fixed rooms
  colors: string[];
  flags: string[];
  shape: Shape;
  tier: Tier;
}
