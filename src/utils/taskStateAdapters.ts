// Утилиты для конвертации между Project (внутренний формат редактора) и SceneStateDto (API формат)
//
// Модель сцены пиксельная (как в Runtime): начало координат — центр сцены,
// x растёт вправо, y растёт вверх, координаты могут быть отрицательными.
// width/height — реальные габариты спрайта на сцене (костюм * размер), нужны бэкенду
// для расчёта столкновений со стенками и яблоками.

import type { Project, SpriteTarget } from '@/types';
import type { SceneStateDto, SpriteStateDto, TaskConfigDto, SpriteType } from '@/services/api';
import { STAGE_WIDTH, STAGE_HEIGHT } from './constants';
import { getSpriteTypeDef } from './spriteTypes';

/**
 * Вычисляет реальные габариты спрайта на сцене с учётом текущего костюма и размера (%).
 */
function getSpriteDimensions(sprite: SpriteTarget): { width: number; height: number } {
    const costume = sprite.costumes[sprite.currentCostume] ?? sprite.costumes[0];
    const scale = (sprite.size ?? 100) / 100;
    const baseWidth = costume?.width ?? getSpriteTypeDef(sprite.type ?? 'cat').width;
    const baseHeight = costume?.height ?? getSpriteTypeDef(sprite.type ?? 'cat').height;
    return {
        width: baseWidth * scale,
        height: baseHeight * scale,
    };
}

/**
 * Определяет тип спрайта: берём явный type, иначе угадываем по имени.
 */
function resolveSpriteType(sprite: SpriteTarget): SpriteType {
    if (sprite.type) return sprite.type;
    const lowerName = sprite.name.toLowerCase();
    if (lowerName.includes('apple') || lowerName.includes('яблоко')) return 'apple';
    if (lowerName.includes('wall') || lowerName.includes('стена')) return 'wall';
    return 'cat';
}

/**
 * Конвертирует SpriteTarget из Project в SpriteStateDto для API.
 * Координаты передаются как есть (в пикселях, со знаком).
 */
export function spriteToSpriteStateDto(sprite: SpriteTarget): SpriteStateDto {
    const { width, height } = getSpriteDimensions(sprite);
    return {
        type: resolveSpriteType(sprite),
        x: sprite.x,
        y: sprite.y,
        width,
        height,
        visible: sprite.visible,
    };
}

/**
 * Конвертирует Project в SceneStateDto для отправки на API.
 */
export function projectToSceneStateDto(project: Project): SceneStateDto {
    const sprites: SpriteStateDto[] = project.sprites.map(sprite => spriteToSpriteStateDto(sprite));
    return { sprites };
}

/**
 * Создаёт TaskConfigDto из размеров сцены проекта.
 */
export function projectToTaskConfigDto(_project: Project): TaskConfigDto {
    return {
        sceneWidth: STAGE_WIDTH,
        sceneHeight: STAGE_HEIGHT,
    };
}

/**
 * Создаёт начальное состояние (initialState) для нового задания с котом в центре.
 */
export function createDefaultInitialState(): SceneStateDto {
    const def = getSpriteTypeDef('cat');
    return {
        sprites: [
            {
                type: 'cat',
                x: 0,
                y: 0,
                width: def.width,
                height: def.height,
                visible: true,
            },
        ],
    };
}

/**
 * Создаёт ожидаемое конечное состояние (expectedFinalState) по умолчанию.
 */
export function createDefaultExpectedState(): SceneStateDto {
    const def = getSpriteTypeDef('cat');
    return {
        sprites: [
            {
                type: 'cat',
                x: 100,
                y: 100,
                width: def.width,
                height: def.height,
                visible: true,
            },
        ],
    };
}

/**
 * Создаёт конфигурацию задания по умолчанию (размеры сцены в пикселях).
 */
export function createDefaultTaskConfig(): TaskConfigDto {
    return {
        sceneWidth: STAGE_WIDTH,
        sceneHeight: STAGE_HEIGHT,
    };
}

/**
 * Конвертирует SceneStateDto в формат для отображения (при загрузке задания из API).
 */
export function sceneStateDtoToDisplayInfo(sceneState: SceneStateDto): {
    sprites: Array<{
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        visible: boolean;
    }>;
} {
    return {
        sprites: (sceneState.sprites || []).map(sprite => ({
            type: sprite.type,
            x: sprite.x,
            y: sprite.y,
            width: sprite.width,
            height: sprite.height,
            visible: sprite.visible,
        })),
    };
}

/**
 * Создаёт спрайт для редактора на основе типа и пиксельных координат.
 */
export function createSpriteFromType(
    type: SpriteType,
    x: number,
    y: number,
    id?: string
): { id: string; name: string; type: SpriteType; x: number; y: number; visible: boolean; emoji: string } {
    const spritesMap: Record<SpriteType, { name: string; emoji: string }> = {
        cat: { name: 'Кот', emoji: '🐱' },
        apple: { name: 'Яблоко', emoji: '🍎' },
        wall: { name: 'Стена', emoji: '🧱' },
    };

    const info = spritesMap[type];

    return {
        id: id || `${type}_${Date.now()}`,
        name: info.name,
        type,
        x,
        y,
        visible: true,
        emoji: info.emoji,
    };
}
