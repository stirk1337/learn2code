import { v4 as uuidv4 } from 'uuid';
import { Project, SpriteTarget, StageTarget, Costume, Sound } from '@/types';
import { DEFAULT_DIRECTION, DEFAULT_SPRITE_SIZE, DEFAULT_VOLUME, DEFAULT_TEMPO } from './constants';
import { getSpriteTypeDef } from './spriteTypes';

const CAT = getSpriteTypeDef('cat');

// Белый фон сцены
const WHITE_BACKDROP = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
  <rect width="480" height="360" fill="white"/>
</svg>
`)}`;

export const createDefaultCostume = (name: string = 'costume1'): Costume => ({
    id: uuidv4(),
    name,
    dataUrl: CAT.assetUrl,
    width: CAT.width,
    height: CAT.height,
    rotationCenterX: CAT.width / 2,
    rotationCenterY: CAT.height / 2,
});

export const createDefaultBackdrop = (name: string = 'backdrop1'): Costume => ({
    id: uuidv4(),
    name,
    dataUrl: WHITE_BACKDROP,
    width: 480,
    height: 360,
    rotationCenterX: 240,
    rotationCenterY: 180,
});

export const createDefaultSprite = (partial?: Partial<SpriteTarget>): SpriteTarget => {
    const id = uuidv4();
    return {
        id,
        name: partial?.name || 'Спрайт1',
        isStage: false,
        type: 'cat',
        x: 0,
        y: 0,
        size: DEFAULT_SPRITE_SIZE,
        direction: DEFAULT_DIRECTION,
        visible: true,
        draggable: false,
        rotationStyle: 'all around',
        currentCostume: 0,
        costumes: [createDefaultCostume()],
        sounds: [],
        volume: DEFAULT_VOLUME,
        layerOrder: 1,
        blocks: '',
        variables: {},
        lists: {},
        ...partial,
    };
};

export const createDefaultStage = (): StageTarget => ({
    id: uuidv4(),
    name: 'Сцена',
    isStage: true,
    currentBackdrop: 0,
    costumes: [createDefaultBackdrop()],
    sounds: [],
    volume: DEFAULT_VOLUME,
    blocks: '',
    variables: {},
    lists: {},
    tempo: DEFAULT_TEMPO,
    videoTransparency: 50,
    videoState: 'off',
});

export const createDefaultProject = (
    name: string,
    authorId: string,
    authorName: string,
    options?: { withDefaultSprite?: boolean }
): Project => ({
    id: uuidv4(),
    name,
    authorId,
    authorName,
    description: '',
    stage: createDefaultStage(),
    sprites: options?.withDefaultSprite === false ? [] : [createDefaultSprite({ name: 'Спрайт1' })],
    extensions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});


import type { SceneStateDto } from '@/services/api';
// Создаёт спрайт по type/x/y/visible (из бэкендового initialState).
// Координаты пиксельные (со знаком), используется канонический костюм из spriteTypes.
export const createSpriteFromState = (state: NonNullable<SceneStateDto['sprites']>[number]): SpriteTarget => {
    const def = getSpriteTypeDef(state.type);
    return createDefaultSprite({
        name: def.name,
        type: state.type,
        x: state.x,
        y: state.y,
        visible: state.visible,
        costumes: [{
            id: uuidv4(),
            name: def.costumeName,
            dataUrl: def.assetUrl,
            width: def.width,
            height: def.height,
            rotationCenterX: def.width / 2,
            rotationCenterY: def.height / 2,
        }],
    });
};

export const buildProjectFromSceneState = (
    name: string,
    authorId: string,
    authorName: string,
    sceneState: SceneStateDto | null | undefined
): Project => {
    const project = createDefaultProject(name, authorId, authorName, { withDefaultSprite: false });
    const sprites = sceneState?.sprites || [];
    project.sprites = sprites.map(s => createSpriteFromState(s));
    return project;
};
