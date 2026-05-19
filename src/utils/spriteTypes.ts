import type { SpriteType } from '@/services/api';

export type { SpriteType };

export interface SpriteTypeDef {
    type: SpriteType;
    name: string;
    costumeName: string;
    assetUrl: string;
    width: number;
    height: number;
}

// Конфигурация трёх допустимых типов спрайтов (cat, apple, wall).
// Картинки лежат в public/assets/sprites и подгружаются по http(s) пути.
export const SPRITE_TYPES: SpriteTypeDef[] = [
    {
        type: 'cat',
        name: 'Кот',
        costumeName: 'cat',
        assetUrl: '/assets/sprites/cat.svg',
        width: 96,
        height: 101,
    },
    {
        type: 'apple',
        name: 'Яблоко',
        costumeName: 'apple',
        assetUrl: '/assets/sprites/apple.svg',
        width: 80,
        height: 80,
    },
    {
        type: 'wall',
        name: 'Стена',
        costumeName: 'wall',
        assetUrl: '/assets/sprites/wall.svg',
        width: 80,
        height: 80,
    },
];

export const getSpriteTypeDef = (type: SpriteType): SpriteTypeDef => {
    return SPRITE_TYPES.find(t => t.type === type) || SPRITE_TYPES[0];
};

// Размер игрового поля в "клетках" по умолчанию (10x8 при 48px = 480x384).
// Конфиг здесь логический — реальный канвас остаётся 480x360.
export const DEFAULT_GRID_WIDTH = 10;
export const DEFAULT_GRID_HEIGHT = 8;
