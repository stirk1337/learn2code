import React from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { SPRITE_TYPES } from '@/utils/spriteTypes';

interface EmptySpritePickerProps {
    title?: string;
    description?: string;
}

const EmptySpritePicker: React.FC<EmptySpritePickerProps> = ({
    title = 'Выберите спрайт',
    description = 'Добавьте на сцену один из готовых спрайтов:',
}) => {
    const { addSpriteOfType } = useProjectStore();
    const { selectSprite } = useEditorStore();

    const handlePick = (type: typeof SPRITE_TYPES[number]['type']) => {
        const id = addSpriteOfType(type);
        selectSprite(id);
    };

    return (
        <div className="flex h-full items-center justify-center bg-white">
            <div className="text-center max-w-xl px-8">
                <h2 className="text-lg font-semibold text-[#1A1D2D] mb-2">{title}</h2>
                <p className="text-sm text-[#6B7280] mb-6">{description}</p>
                <div className="flex justify-center gap-4">
                    {SPRITE_TYPES.map(t => (
                        <button
                            key={t.type}
                            onClick={() => handlePick(t.type)}
                            className="flex flex-col items-center gap-2 p-4 rounded-[16px] border border-[#E0E4EB] bg-white hover:border-[#734DE6] hover:bg-[#F8FAFB] transition-colors w-32"
                        >
                            <img
                                src={t.assetUrl}
                                alt={t.name}
                                className="w-16 h-16 object-contain"
                                draggable={false}
                            />
                            <span className="text-sm font-medium text-[#1A1D2D]">{t.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EmptySpritePicker;
