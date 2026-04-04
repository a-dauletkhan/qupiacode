import {
  COLOR_SWATCHS,
  FONT_WEIGHT_OPTIONS,
  PAINT_STYLE_OPTIONS,
  SHAPE_KIND_OPTIONS,
  TEXT_COLOR_SWATCHS,
  TEXT_ALIGN_OPTIONS,
  clampFontSize,
  clampStrokeWidth,
  isShapeNode,
  isStickyNoteNode,
  isTextNode,
  type CanvasFontWeight,
  type CanvasObjectNode,
  type CanvasTextAlign,
  type PrimitivePaintStyle,
  type ShapeKind,
} from "./schema"

export type PropertyControlType = "color" | "segmented" | "slider" | "textarea"

export type EditablePropertyKey =
  | "shapeKind"
  | "label"
  | "color"
  | "paintStyle"
  | "strokeWidth"
  | "text"
  | "textColor"
  | "fontSize"
  | "fontWeight"
  | "align"

type BaseEditableProperty = {
  key: EditablePropertyKey
  label: string
  controlType: PropertyControlType
}

type OptionProperty = BaseEditableProperty & {
  controlType: "color" | "segmented"
  value: string
  options: Array<{ label: string; value: string }>
}

type SliderProperty = BaseEditableProperty & {
  controlType: "slider"
  value: number
  min: number
  max: number
  step: number
}

type TextareaProperty = BaseEditableProperty & {
  controlType: "textarea"
  value: string
  placeholder: string
}

export type EditableProperty =
  | OptionProperty
  | SliderProperty
  | TextareaProperty

export type ObjectPropertySchema = {
  title: string
  properties: EditableProperty[]
}

export function getObjectPropertySchema(
  node: CanvasObjectNode
): ObjectPropertySchema {
  if (isShapeNode(node)) {
    return {
      title: "Shape",
      properties: [
        {
          key: "label",
          label: "Content",
          controlType: "textarea",
          value: node.data.content.label,
          placeholder: "Type something",
        },
        {
          key: "shapeKind",
          label: "Type",
          controlType: "segmented",
          value: node.data.shapeKind,
          options: [...SHAPE_KIND_OPTIONS],
        },
        {
          key: "color",
          label: "Color",
          controlType: "color",
          value: node.data.style.color,
          options: COLOR_SWATCHS,
        },
        {
          key: "paintStyle",
          label: "Paint",
          controlType: "segmented",
          value: node.data.style.paintStyle,
          options: PAINT_STYLE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.id,
          })),
        },
        {
          key: "strokeWidth",
          label: "Stroke",
          controlType: "slider",
          value: node.data.style.strokeWidth,
          min: 1,
          max: 8,
          step: 1,
        },
      ],
    }
  }

  if (isTextNode(node)) {
    return {
      title: "Text",
      properties: [
        {
          key: "text",
          label: "Content",
          controlType: "textarea",
          value: node.data.content.text,
          placeholder: "Type something",
        },
        {
          key: "color",
          label: "Color",
          controlType: "color",
          value: node.data.style.color,
          options: COLOR_SWATCHS,
        },
        {
          key: "fontSize",
          label: "Size",
          controlType: "slider",
          value: node.data.style.fontSize,
          min: 12,
          max: 72,
          step: 1,
        },
        {
          key: "align",
          label: "Align",
          controlType: "segmented",
          value: node.data.style.align,
          options: [...TEXT_ALIGN_OPTIONS],
        },
        {
          key: "fontWeight",
          label: "Weight",
          controlType: "segmented",
          value: node.data.style.fontWeight,
          options: [...FONT_WEIGHT_OPTIONS],
        },
      ],
    }
  }

  if (isStickyNoteNode(node)) {
    return {
      title: "Sticky Note",
      properties: [
        {
          key: "text",
          label: "Content",
          controlType: "textarea",
          value: node.data.content.text,
          placeholder: "Add note",
        },
        {
          key: "color",
          label: "Note color",
          controlType: "color",
          value: node.data.style.color,
          options: COLOR_SWATCHS,
        },
        {
          key: "textColor",
          label: "Text color",
          controlType: "color",
          value: node.data.style.textColor,
          options: TEXT_COLOR_SWATCHS,
        },
        {
          key: "fontSize",
          label: "Size",
          controlType: "slider",
          value: node.data.style.fontSize,
          min: 12,
          max: 48,
          step: 1,
        },
      ],
    }
  }

  return {
    title: "Object",
    properties: [],
  }
}

export function applyObjectProperty(
  node: CanvasObjectNode,
  key: EditablePropertyKey,
  value: string | number
): CanvasObjectNode {
  if (isShapeNode(node)) {
    switch (key) {
      case "shapeKind":
        return {
          ...node,
          data: {
            ...node.data,
            shapeKind: value as ShapeKind,
            content: {
              ...node.data.content,
              label:
                !node.data.content.label ||
                node.data.content.label === "Rectangle" ||
                node.data.content.label === "Diamond" ||
                node.data.content.label === "Ellipse"
                  ? value === "rectangle"
                    ? "Rectangle"
                    : value === "diamond"
                      ? "Diamond"
                      : "Ellipse"
                  : node.data.content.label,
            },
          },
        }
      case "label":
        return {
          ...node,
          data: {
            ...node.data,
            content: {
              label: value as string,
            },
          },
        }
      case "color":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              color: value as string,
            },
          },
        }
      case "paintStyle":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              paintStyle: value as PrimitivePaintStyle,
            },
          },
        }
      case "strokeWidth":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              strokeWidth: clampStrokeWidth(value as number),
            },
          },
        }
    }
  }

  if (isTextNode(node)) {
    switch (key) {
      case "text":
        return {
          ...node,
          data: {
            ...node.data,
            content: {
              text: value as string,
            },
          },
        }
      case "color":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              color: value as string,
            },
          },
        }
      case "fontSize":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              fontSize: clampFontSize(value as number),
            },
          },
        }
      case "align":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              align: value as CanvasTextAlign,
            },
          },
        }
      case "fontWeight":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              fontWeight: value as CanvasFontWeight,
            },
          },
        }
    }
  }

  if (isStickyNoteNode(node)) {
    switch (key) {
      case "text":
        return {
          ...node,
          data: {
            ...node.data,
            content: {
              text: value as string,
            },
          },
        }
      case "color":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              color: value as string,
            },
          },
        }
      case "textColor":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              textColor: value as string,
            },
          },
        }
      case "fontSize":
        return {
          ...node,
          data: {
            ...node.data,
            style: {
              ...node.data.style,
              fontSize: clampFontSize(value as number),
            },
          },
        }
    }
  }

  return node
}
