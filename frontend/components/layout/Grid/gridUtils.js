export const getBottom = (item) => {
  return item.y + item.h;
};

export const getRight = (item) => {
  return item.x + item.w;
};

export const itemsCollide = (item1, item2) => {
  if (item1.id === item2.id) return false;

  return !(
    item1.x >= getRight(item2) ||
    getRight(item1) <= item2.x ||
    item1.y >= getBottom(item2) ||
    getBottom(item1) <= item2.y
  );
};

export const getCollidingItems = (layout, item) => {
  return layout.filter(
    (layoutItem) => layoutItem.id !== item.id && itemsCollide(layoutItem, item)
  );
};

export const compactLayout = (layout, cols) => {
  const sorted = [...layout].sort((a, b) => {
    if (a.y === b.y) return a.x - b.x;
    return a.y - b.y;
  });

  const compacted = [];

  sorted.forEach((item) => {
    let newY = 0;

    // Find the lowest position where item can be placed
    while (true) {
      const testItem = { ...item, y: newY };
      const collisions = getCollidingItems(compacted, testItem);

      if (collisions.length === 0) {
        compacted.push(testItem);
        break;
      }

      newY++;
    }
  });

  return sorted;
};

export const validateLayout = (layout, cols) => {
  const errors = [];

  layout.forEach((item, index) => {
    // Check required properties
    if (!item.id) {
      errors.push(`Item at index ${index} missing required 'id' property`);
    }
    if (typeof item.x !== "number") {
      errors.push(`Item ${item.id || index} missing required 'x' property`);
    }
    if (typeof item.y !== "number") {
      errors.push(`Item ${item.id || index} missing required 'y' property`);
    }
    if (typeof item.w !== "number" || item.w <= 0) {
      errors.push(`Item ${item.id || index} has invalid 'w' property`);
    }
    if (typeof item.h !== "number" || item.h <= 0) {
      errors.push(`Item ${item.id || index} has invalid 'h' property`);
    }

    // Check bounds
    if (item.x < 0) {
      errors.push(`Item ${item.id} has negative x position`);
    }
    if (item.y < 0) {
      errors.push(`Item ${item.id} has negative y position`);
    }
    if (item.x + item.w > cols) {
      errors.push(
        `Item ${item.id} exceeds column bounds (x: ${item.x}, w: ${item.w}, cols: ${cols})`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const cloneLayout = (layout) => {
  return layout.map((item) => ({ ...item }));
};

export const getFirstAvailablePosition = (layout, width, height, cols) => {
  let y = 0;

  while (true) {
    for (let x = 0; x <= cols - width; x++) {
      const testItem = { x, y, w: width, h: height, id: "test" };
      const collisions = getCollidingItems(layout, testItem);

      if (collisions.length === 0) {
        return { x, y };
      }
    }
    y++;
  }
};

export const getLayoutBounds = (layout) => {
  if (layout.length === 0) {
    return { width: 0, height: 0 };
  }

  const maxX = Math.max(...layout.map((item) => getRight(item)));
  const maxY = Math.max(...layout.map((item) => getBottom(item)));

  return { width: maxX, height: maxY };
};

/**
 * Sort layout items by their position (top to bottom, left to right)
 * @param {Array} layout - Array of grid items
 * @returns {Array} Sorted layout
 */
export const sortLayout = (layout) => {
  return [...layout].sort((a, b) => {
    if (a.y === b.y) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });
};

export const moveItem = (layout, itemId, x, y) => {
  return layout.map((item) => (item.id === itemId ? { ...item, x, y } : item));
};

/**
 * Resize an item
 * @param {Array} layout - Array of grid items
 * @param {string} itemId - ID of item to resize
 * @param {number} w - New width
 * @param {number} h - New height
 * @returns {Array} Updated layout
 */
export const resizeItem = (layout, itemId, w, h) => {
  return layout.map((item) => (item.id === itemId ? { ...item, w, h } : item));
};

/**
 * Remove an item from layout
 * @param {Array} layout - Array of grid items
 * @param {string} itemId - ID of item to remove
 * @returns {Array} Updated layout
 */
export const removeItem = (layout, itemId) => {
  return layout.filter((item) => item.id !== itemId);
};

/**
 * Add an item to layout
 * @param {Array} layout - Array of grid items
 * @param {Object} item - Item to add
 * @param {number} cols - Number of columns
 * @param {boolean} autoPosition - Automatically find position for item
 * @returns {Array} Updated layout
 */
export const addItem = (layout, item, cols, autoPosition = true) => {
  if (autoPosition && (item.x === undefined || item.y === undefined)) {
    const position = getFirstAvailablePosition(layout, item.w, item.h, cols);
    item = { ...item, ...position };
  }

  return [...layout, item];
};

/**
 * Generate a sample layout for testing
 * @param {number} itemCount - Number of items to generate
 * @param {number} cols - Number of columns
 * @returns {Array} Generated layout
 */
export const generateSampleLayout = (itemCount, cols = 12) => {
  const layout = [];

  for (let i = 0; i < itemCount; i++) {
    const w = Math.floor(Math.random() * 4) + 2; // Width 2-5
    const h = Math.floor(Math.random() * 2) + 1; // Height 1-2

    const position = getFirstAvailablePosition(layout, w, h, cols);

    layout.push({
      id: `item-${i}`,
      x: position.x,
      y: position.y,
      w,
      h,
      content: null,
    });
  }

  return layout;
};

/**
 * Convert layout to/from storage format
 */
export const serializeLayout = (layout) => {
  return JSON.stringify(
    layout.map(({ id, x, y, w, h, style }) => ({
      id,
      x,
      y,
      w,
      h,
      style,
    }))
  );
};

export const deserializeLayout = (serialized, contentMap) => {
  const layout = JSON.parse(serialized);
  return layout.map((item) => ({
    ...item,
    content: contentMap[item.id] || null,
  }));
};
