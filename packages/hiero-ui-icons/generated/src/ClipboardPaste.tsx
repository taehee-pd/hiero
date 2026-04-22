import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type ClipboardPasteProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  reduceMotion?: boolean | 'system';
  variant?: "v-16" | "v-24" | "16" | "24" | number;
  effect?: never;
  animate?: boolean;
};

const iconData = {
  "id": "clipboard-paste",
  "name": "clipboardPaste",
  "variants": {
    "v-16": {
      "id": "v-16",
      "name": "16",
      "size": 16,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M11 14 L21 14"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M16 4 L18 4 C19.104569 4 20 4.895431 20 6 L20 7.344"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M17 18 L21 14 L17 10"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M8 4 L6 4 C4.895431 4 4 4.895431 4 6 L4 20 C4 21.104569 4.895431 22 6 22 L18 22 C18.760696 22.000172 19.455631 21.568792 19.793 20.887"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "rect": {
          "id": "rect",
          "path": {
            "d": "M9 2 L15 2 C15.552285 2 16 2.447715 16 3 L16 5 C16 5.552285 15.552285 6 15 6 L9 6 C8.447715 6 8 5.552285 8 5 L8 3 C8 2.447715 8.447715 2 9 2 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M11 14 L21 14"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M16 4 L18 4 C19.104569 4 20 4.895431 20 6 L20 7.344"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M17 18 L21 14 L17 10"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M8 4 L6 4 C4.895431 4 4 4.895431 4 6 L4 20 C4 21.104569 4.895431 22 6 22 L18 22 C18.760696 22.000172 19.455631 21.568792 19.793 20.887"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "rect": {
              "id": "rect",
              "path": {
                "d": "M9 2 L15 2 C15.552285 2 16 2.447715 16 3 L16 5 C16 5.552285 15.552285 6 15 6 L9 6 C8.447715 6 8 5.552285 8 5 L8 3 C8 2.447715 8.447715 2 9 2 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    },
    "v-24": {
      "id": "v-24",
      "name": "24",
      "size": 24,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M11 14 L21 14"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M16 4 L18 4 C19.104569 4 20 4.895431 20 6 L20 7.344"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M17 18 L21 14 L17 10"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M8 4 L6 4 C4.895431 4 4 4.895431 4 6 L4 20 C4 21.104569 4.895431 22 6 22 L18 22 C18.760696 22.000172 19.455631 21.568792 19.793 20.887"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "rect": {
          "id": "rect",
          "path": {
            "d": "M9 2 L15 2 C15.552285 2 16 2.447715 16 3 L16 5 C16 5.552285 15.552285 6 15 6 L9 6 C8.447715 6 8 5.552285 8 5 L8 3 C8 2.447715 8.447715 2 9 2 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M11 14 L21 14"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M16 4 L18 4 C19.104569 4 20 4.895431 20 6 L20 7.344"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M17 18 L21 14 L17 10"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M8 4 L6 4 C4.895431 4 4 4.895431 4 6 L4 20 C4 21.104569 4.895431 22 6 22 L18 22 C18.760696 22.000172 19.455631 21.568792 19.793 20.887"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "rect": {
              "id": "rect",
              "path": {
                "d": "M9 2 L15 2 C15.552285 2 16 2.447715 16 3 L16 5 C16 5.552285 15.552285 6 15 6 L9 6 C8.447715 6 8 5.552285 8 5 L8 3 C8 2.447715 8.447715 2 9 2 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    }
  },
  "meta": {
    "externalImport": {
      "adapterId": "lucide",
      "sourceLibrary": "lucide",
      "sourceVersion": "0.577.0",
      "sourceIconId": "clipboard-paste",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.988Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function ClipboardPaste({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: ClipboardPasteProps) {
  return (
    <HieroIcon
      icon={typedIconData}
      size={size}
      color={color}
      className={className}
      style={style}
      label={label}
      reduceMotion={reduceMotion}
      variant={variant}
      animate={animate}
    />
  );
}
