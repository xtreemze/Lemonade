# 3D Gizmo Dev Tool Guide

A powerful developer tool for manipulating and previewing 3D scene object positions in real-time.

## Quick Start

### Enable the Gizmo

Open the browser console (F12 or Cmd+Option+I) and run:

```javascript
enableGizmo()
```

Then refresh the page. The gizmo UI will appear in the top-left corner with a magenta border.

### Disable the Gizmo

```javascript
disableGizmo()
```

Then refresh the page.

### Alternative: localStorage

If you prefer using localStorage directly:

```javascript
// Enable
localStorage.setItem('LEMONADE_DEV_GIZMO', '1')

// Disable
localStorage.removeItem('LEMONADE_DEV_GIZMO')
```

## Usage

### Selecting Objects

1. **Click** on any 3D object in the scene to select it
2. A **magenta bounding box** will appear around the selected object
3. The info panel shows the object's name and current transform values
4. **ESC** to deselect the object

### Transform Modes

Three transform modes are available (keyboard shortcuts):

| Mode | Key | Description |
|------|-----|-------------|
| **Move (Translate)** | `G` | Drag objects to new positions |
| **Rotate** | `R` | Rotate objects around their center |
| **Scale** | `S` | Resize objects uniformly |

### Controls

- **Left Mouse Drag**: Transform the selected object (mode-dependent)
- **G Key**: Switch to Translate mode
- **R Key**: Switch to Rotate mode (currently hover preview only)
- **S Key**: Switch to Scale mode (currently hover preview only)
- **ESC**: Deselect current object
- **Move cursor**: Hover over objects to show they're selectable (pointer cursor)

## UI Controls

The gizmo panel (top-left corner) provides these controls:

### Transform Mode Buttons

- **Move (G)**: Active button (magenta) shows current mode
- **Rotate (R)**: Switch to rotation mode
- **Scale (S)**: Switch to scaling mode

### Action Buttons

- **💾 Save Transform**: Save the current object's position, rotation, and scale
- **📋 Export JSON**: Download all saved transforms as a `.json` file
- **📝 Export Code**: Download saved transforms as TypeScript code (`.ts`)
- **📋 Copy JSON**: Copy transforms to clipboard

### Info Panel

Shows real-time information about the selected object:
- Object name
- Current position (X, Y, Z)
- Current rotation (X, Y, Z) in radians
- Current scale (X, Y, Z)
- Number of transforms saved so far

## Workflow: Repositioning Objects

### Step-by-Step Example

1. **Launch the gizmo**
   ```javascript
   enableGizmo()
   // Refresh the page
   ```

2. **Select an object**
   - Click on the lemonade stand, a sign, or any element in the scene
   - Watch for the magenta bounding box

3. **Move it to a new position**
   - Press `G` to ensure you're in Move mode (button turns magenta)
   - Drag the object to the desired location
   - The info panel updates in real-time

4. **Fine-tune if needed**
   - Make small adjustments by dragging
   - Watch the coordinates in the info panel

5. **Save the transform**
   - Click **💾 Save Transform** button
   - The saved count updates at the bottom

6. **Reposition other objects**
   - Click a different object
   - Repeat steps 3-5

7. **Export the transforms**
   - Click **📝 Export Code** to download as TypeScript
   - Or **📋 Export JSON** for JSON format
   - Or **📋 Copy JSON** to get it on your clipboard

## Exporting and Applying Changes

### Export Formats

#### JSON Format

```json
[
  {
    "uuid": "abc123...",
    "name": "lemonadeStand",
    "position": [0, 1.5, -2],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1]
  },
  {
    "uuid": "def456...",
    "name": "advertisingSign",
    "position": [3.5, 0.5, -1],
    "rotation": [0, 0.5, 0],
    "scale": [1, 1.2, 1]
  }
]
```

#### TypeScript Format

```typescript
// Scene object positions and transforms

// lemonadeStand (abc123...)
object.position.set(0, 1.5, -2);
object.rotation.set(0, 0, 0);
object.scale.set(1, 1, 1);

// advertisingSign (def456...)
object.position.set(3.5, 0.5, -1);
object.rotation.set(0, 0.5, 0);
object.scale.set(1, 1.2, 1);
```

### Applying Changes to the Scene

1. **Get the exported code** from the gizmo UI
2. **Find the object** being positioned in the source code
3. **Apply the transform values** to the object's position, rotation, or scale:

```typescript
// In packages/scene/src/index.ts or related files
const stand = createStand();
stand.root.position.set(0, 1.5, -2);  // Updated position
stand.root.rotation.set(0, 0, 0);      // Updated rotation
stand.root.scale.set(1, 1, 1);         // Updated scale
scene.add(stand.root);
```

## Console Commands

After enabling the gizmo, these commands are available globally:

```javascript
// Enable gizmo (persistent across refreshes)
enableGizmo()

// Disable gizmo
disableGizmo()

// Print this help guide
gizmoHelp()
```

## Tips & Tricks

### Camera Control
- The gizmo uses simplified camera calculations for 2D-style dragging
- Objects move in the XY plane while maintaining their Z position
- Adjust camera position in scene code for better viewing angles

### Multiple Objects
- Save multiple transforms in one session
- Each transform is tracked by the object's UUID
- Export all at once with one button click

### Real-time Preview
- See changes immediately without leaving the dev tool
- The entire scene updates as you drag
- Perfect for tweaking placement without code recompile

### Workflow Efficiency
- Use keyboard shortcuts (G, R, S) to quickly switch modes
- ESC key is your escape hatch for deselection
- Hover detection shows which objects are selectable

### Collaboration
- Export JSON and share with team members
- Include the exported code in PR descriptions
- Easy to review and verify positioning changes

## Limitations

- **Translate Mode**: Currently fully functional for moving objects
- **Rotate/Scale Modes**: UI buttons exist but rotation/scale via drag not yet fully implemented
- **Z-Depth**: Objects maintain their Z position; dragging affects X/Y only
- **Group Transforms**: Selects individual objects or groups at root level
- **Nested Objects**: May need to select parent group to affect children

## Troubleshooting

### "No object selected" message
- Make sure you're clicking directly on visible scene objects
- Some objects might not be selectable (helpers, lights, etc.)
- Try clicking on character models or the stand

### Changes not saving
- Make sure to click **💾 Save Transform** button after moving
- Check browser console for errors (F12)

### Export not working
- Clear browser cache and refresh
- Try the **📋 Copy JSON** button instead of download
- Check browser console for any error messages

### Objects not moving
- Ensure **Move (G)** mode is active (button should be magenta)
- Make sure object is selected (magenta bounding box visible)
- Try pressing `G` key to explicitly enter move mode

## Keyboard Reference

| Key | Action |
|-----|--------|
| `G` | Switch to Move (Translate) mode |
| `R` | Switch to Rotate mode |
| `S` | Switch to Scale mode |
| `ESC` | Deselect current object |
| `Left Mouse Drag` | Transform object in current mode |
| `Mouse Click` | Select object |

## Scene Structure Notes

The gizmo works with Three.js objects in the Lemonsville scene:

- **Stand**: The lemonade stand structure
- **Signs**: Advertising signs (40 instances)
- **Ground**: The grass/street plane
- **Characters**: Customers and seller
- **Weather Elements**: Clouds, sun, etc.

Most static scene elements can be repositioned using the gizmo.

## Advanced: Custom Selectable Objects

To customize which objects are selectable, modify the gizmo initialization in `src/index.ts`:

```typescript
gizmo = createGizmoController({
  camera,
  scene,
  container: canvas.parentElement || document.body,
  selectableObjects: [stand.root, ...signs.map(s => s.root)], // Only select specific objects
});
```

## See Also

- Three.js documentation: https://threejs.org/
- WebGL Renderer docs
- Raycasting for object selection concepts

---

**Last Updated**: September 22, 2026

**Version**: 1.0
