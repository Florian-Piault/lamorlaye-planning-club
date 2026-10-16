import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { moveItem } from "@/domain/usage";
import { cn } from "@/lib/utils";

interface SortableListProps<T extends { id: string }> {
  items: readonly T[];
  /** Nom d'un élément, pour la poignée (« Déplacer Court 1 »). */
  itemName: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Nouvel ordre après un glisser-déposer. */
  onReorder: (items: T[]) => void;
  label: string;
  /** Lecture seule : liste non réordonnable, sans poignées. */
  readOnly?: boolean;
}

/**
 * Liste réordonnable par glisser-déposer (dnd-kit), à la souris ou au clavier
 * (Espace sur la poignée, puis flèches et Espace).
 */
export function SortableList<T extends { id: string }>({
  items,
  itemName,
  renderItem,
  onReorder,
  label,
  readOnly = false,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (readOnly) {
    return (
      <ul aria-label={label} className="divide-y rounded-lg border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex min-h-11 items-center gap-3 bg-background px-3 py-1.5"
            data-testid="sortable-item"
          >
            {renderItem(item)}
          </li>
        ))}
      </ul>
    );
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(moveItem(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Pour déplacer un élément, appuyez sur Espace, utilisez les flèches puis appuyez de nouveau sur Espace pour le déposer, ou sur Échap pour annuler.",
        },
        announcements: {
          onDragStart: () => "Élément saisi.",
          onDragOver: () => "Élément déplacé.",
          onDragEnd: () => "Élément déposé.",
          onDragCancel: () => "Déplacement annulé.",
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="divide-y rounded-lg border">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} name={itemName(item)}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 bg-background px-2 py-1.5",
        isDragging && "relative z-10 shadow-md",
      )}
      data-testid="sortable-item"
    >
      <Tooltip content="Glisser pour changer l'ordre (au clavier : Espace, puis flèches)">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer ${name}`}
          className="flex size-8 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </Tooltip>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
    </li>
  );
}
