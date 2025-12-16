document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const newTileModal = document.getElementById('new-tile-modal');
    const btnNewTile = document.getElementById('btn-new-tile');
    const btnCancelTile = document.getElementById('btn-cancel-tile');
    const btnCreateTile = document.getElementById('btn-create-tile');
    const toolsPalette = document.getElementById('tools-palette');
    const btnToolDraw = document.getElementById('btn-tool-draw');
    const btnToolFill = document.getElementById('btn-tool-fill');
    const btnToolErase = document.getElementById('btn-tool-erase'); // Added
    const btnToolPolygon = document.getElementById('btn-tool-polygon');
    const polygonShapeSelection = document.getElementById('polygon-shape-selection'); // Added
    const btnShapeRectangle = document.getElementById('btn-shape-rectangle');     // Added
    const btnShapeCircle = document.getElementById('btn-shape-circle');       // Added
    const btnLoad = document.getElementById('btn-load');
    const btnLoadPalette = document.getElementById('btn-load-palette');
    const fileLoader = document.getElementById('file-loader');
    const btnClearAll = document.getElementById('btn-clear-all'); // Added Clear All button
    const btnExportText = document.getElementById('btn-export-text'); // Added Export as Text button

    // Canvas resize elements
    const canvasWidthInput = document.getElementById('canvas-width');    // Added
    const canvasHeightInput = document.getElementById('canvas-height');  // Added
    const btnApplyCanvasSize = document.getElementById('btn-apply-canvas-size'); // Added


    const TILE_SIZE = 32;
    let MAP_WIDTH = 800;
    let MAP_HEIGHT = 608;
    let MAP_COLS = MAP_WIDTH / TILE_SIZE;
    let MAP_ROWS = MAP_HEIGHT / TILE_SIZE;
    let mapData = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(null));

    let currentTool = 'draw'; // 'draw' or 'fill'
    let currentShape = 'rectangle'; // 'rectangle' or 'circle' - for polygon tool

    // Zoom and pan variables
    let scale = 1.0;
    let offsetX = 0;
    let offsetY = 0;
    const zoomFactor = 1.1; // How much to zoom in/out per scroll

    // Pan variables
    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Undo/Redo history
    const MAX_HISTORY_SIZE = 50; // Limit history to prevent excessive memory usage
    let history = [];
    let historyPointer = -1;

    class Palette {
        constructor() {
            this.tiles = [];
            this.selectedTile = null;
        }

        clear() {
            this.tiles = [];
            this.selectedTile = null;
            this.render();
        }

        addTile(tile) {
            this.tiles.push(tile);
            this.render();
        }

        selectTile(tile) {
            this.selectedTile = tile;
            this.render();
        }

        render() {
            toolsPalette.innerHTML = '';
            this.tiles.forEach(tile => {
                const tileEl = document.createElement('div');
                tileEl.className = 'tile-item';
                if (tile === this.selectedTile) {
                    tileEl.classList.add('selected');
                }
                tileEl.style.backgroundColor = tile.color;
                tileEl.textContent = tile.char;
                tileEl.title = tile.name;
                tileEl.addEventListener('click', () => this.selectTile(tile));
                toolsPalette.appendChild(tileEl);
            });
        }
    }

    const palette = new Palette();

    // Function to resize the canvas
    function resizeCanvas() {
        const newMAP_COLS = parseInt(canvasWidthInput.value);
        const newMAP_ROWS = parseInt(canvasHeightInput.value);

        if (isNaN(newMAP_COLS) || isNaN(newMAP_ROWS) || newMAP_COLS <= 0 || newMAP_ROWS <= 0) {
            alert(`Invalid dimensions. Please enter positive numbers for tile counts.`);
            canvasWidthInput.value = MAP_COLS;
            canvasHeightInput.value = MAP_ROWS;
            return;
        }

        const newWidth = newMAP_COLS * TILE_SIZE;
        const newHeight = newMAP_ROWS * TILE_SIZE;
        
        // Create new mapData array
        const newMapData = Array(newMAP_ROWS).fill(null).map(() => Array(newMAP_COLS).fill(null));

        // Copy existing mapData to the new mapData
        for (let row = 0; row < Math.min(MAP_ROWS, newMAP_ROWS); row++) {
            for (let col = 0; col < Math.min(MAP_COLS, newMAP_COLS); col++) {
                newMapData[row][col] = mapData[row][col];
            }
        }

        // Update global variables
        MAP_WIDTH = newWidth;
        MAP_HEIGHT = newHeight;
        MAP_COLS = newMAP_COLS;
        MAP_ROWS = newMAP_ROWS;
        mapData = newMapData;

        // Update canvas element dimensions
        canvas.width = MAP_WIDTH;
        canvas.height = MAP_HEIGHT;

        // Reset zoom and pan on canvas resize
        scale = 1.0;
        offsetX = 0;
        offsetY = 0;

        redrawCanvas();
        saveState(); // Save state after resize
    }

    // Initialize canvas
    function setupCanvas() {
        canvas.width = MAP_WIDTH;
        canvas.height = MAP_HEIGHT;
        canvasWidthInput.value = MAP_COLS; // Initialize input with current tile count
        canvasHeightInput.value = MAP_ROWS; // Initialize input with current tile count

        // Ensure initial zoom/pan state is reset
        scale = 1.0;
        offsetX = 0;
        offsetY = 0;

        redrawCanvas();
        saveState(); // Save initial state
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas based on its current dimensions

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        drawGrid();
        for (let row = 0; row < MAP_ROWS; row++) {
            for (let col = 0; col < MAP_COLS; col++) {
                const tile = mapData[row][col];
                if (tile) {
                    drawTile(col * TILE_SIZE, row * TILE_SIZE, tile);
                }
            }
        }
        ctx.restore();
    }

    // Function to clear all tiles on the canvas
    function clearAllCanvas() {
        mapData = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(null));
        redrawCanvas();
        saveState(); // Save state after clearing
    }

    // Function to export map data as text
    function exportMapAsText() {
        const exportedText = mapData.map(row =>
            row.map(tile => (tile ? tile.char : '.')).join('')
        );
        alert('Copy the following text:\n\n' + JSON.stringify(exportedText, null, 2));
    }

    // Draw grid lines
    function drawGrid() {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5 / scale; // Adjust line width based on scale

        for (let x = 0; x <= MAP_WIDTH; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, MAP_HEIGHT);
            ctx.stroke();
        }

        for (let y = 0; y <= MAP_HEIGHT; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(MAP_WIDTH, y);
            ctx.stroke();
        }
    }

    function showModal() {
        newTileModal.style.display = 'block';
    }

    function hideModal() {
        newTileModal.style.display = 'none';
    }

    function createTile() {
        const nameInput = document.getElementById('tile-name');
        const charInput = document.getElementById('tile-char');
        const colorInput = document.getElementById('tile-color');

        const name = nameInput.value;
        const char = charInput.value;
        const color = colorInput.value;

        if (name && char) {
            palette.addTile({ name, char, color });
            hideModal();
            // Reset form
            nameInput.value = '';
            charInput.value = '';
            colorInput.value = '#ffffff';
        } else {
            alert('Please fill in all fields.');
        }
    }

    function drawTile(x, y, tile) {
        ctx.fillStyle = tile.color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        
        ctx.fillStyle = '#000';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.char, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    }

    function floodFill(startCol, startRow, fillTile) {
        const startTile = mapData[startRow][startCol];
        if (startTile === fillTile) {
            return;
        }

        const visited = new Set();
        const queue = [[startRow, startCol]];
        visited.add(`${startRow},${startCol}`);

        while (queue.length > 0) {
            const [row, col] = queue.shift();

            if (mapData[row][col] === startTile) {
                mapData[row][col] = fillTile;

                const neighbors = [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]];
                for (const [nRow, nCol] of neighbors) {
                    const key = `${nRow},${nCol}`;
                    if (nRow >= 0 && nRow < MAP_ROWS && nCol >= 0 && nCol < MAP_COLS && !visited.has(key)) {
                        queue.push([nRow, nCol]);
                        visited.add(key);
                    }
                }
            }
        }
        redrawCanvas();
        saveState(); // Save state after flood fill
    }

    function applyRectangleToMap(startCol, startRow, endCol, endRow, tile) {
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                    mapData[row][col] = tile;
                }
            }
        }
        saveState(); // Save state after applying rectangle
    }

    function applyCircleToMap(startCol, startRow, endCol, endRow, tile) {
        const centerX = startCol;
        const centerY = startRow;
        const radius = Math.round(Math.sqrt(Math.pow(endCol - centerX, 2) + Math.pow(endRow - centerY, 2)));

        if (radius <= 0) return;

        const setTile = (col, row) => {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                mapData[row][col] = tile;
            }
        };

        const rowsToFill = new Map(); // Map<row, {minCol, maxCol}>

        const plotPoint = (cx, cy, x, y) => {
            const points = [
                { col: cx + x, row: cy + y },
                { col: cx - x, row: cy + y },
                { col: cx + x, row: cy - y },
                { col: cx - x, row: cy - y },
                { col: cx + y, row: cy + x },
                { col: cx - y, row: cy + x },
                { col: cx + y, row: cy - x },
                { col: cx - y, row: cy - x },
            ];

            points.forEach(p => {
                const { col, row } = p;
                if (rowsToFill.has(row)) {
                    rowsToFill.get(row).minCol = Math.min(rowsToFill.get(row).minCol, col);
                    rowsToFill.get(row).maxCol = Math.max(rowsToFill.get(row).maxCol, col);
                } else {
                    rowsToFill.set(row, { minCol: col, maxCol: col });
                }
            });
        };

        let x = 0;
        let y = radius;
        let p = 3 - 2 * radius; // Decision parameter

        plotPoint(centerX, centerY, x, y);

        while (y >= x) {
            x++;
            if (p > 0) {
                y--;
                p = p + 4 * (x - y) + 10;
            } else {
                p = p + 4 * x + 6;
            }
            plotPoint(centerX, centerY, x, y);
        }

        // Fill the interior of the circle
        for (let [row, colRange] of rowsToFill.entries()) {
            for (let col = colRange.minCol; col <= colRange.maxCol; col++) {
                setTile(col, row);
            }
        }
        saveState(); // Save state after applying circle
    }


    let isDrawing = false;
    let startPoint = null; // Added for polygon tool
    // Removed spacePressed variable as panning will now be handled by right-click

    function handleCanvasMouseDown(e) {
        // If right-click, start panning
        if (e.button === 2) { // Right mouse button
            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            return; // Don't process other tools if panning
        }

        // Existing logic for left-click tools
        if (!palette.selectedTile && currentTool !== 'erase') return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert screen coordinates to canvas coordinates
        const x = (mouseX - offsetX) / scale;
        const y = (mouseY - offsetY) / scale;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw') {
            isDrawing = true;
            drawOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'fill') {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                floodFill(col, row, palette.selectedTile);
            }
        } else if (currentTool === 'erase') { // Added erase tool logic
            isDrawing = true;
            eraseOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'polygon') { // Added polygon tool logic
            isDrawing = true;
            startPoint = { col, row };
        }
    }

    function handleCanvasMouseMove(e) {
        if (isPanning) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;

            offsetX += dx;
            offsetY += dy;

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            
            redrawCanvas();
            return; // Don't process other tools if panning
        }

        if (!isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert screen coordinates to canvas coordinates
        const x = (mouseX - offsetX) / scale;
        const y = (mouseY - offsetY) / scale;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw' && palette.selectedTile) {
            drawOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'erase') {
            eraseOnCanvas(x, y); // Pass transformed coordinates
        } else if (currentTool === 'polygon' && startPoint) { // Preview for polygon tool
            redrawCanvas(); // Clear canvas and redraw existing map
            drawTemporaryShape(startPoint.col, startPoint.row, col, row);
        }
    }

    // Helper function to draw temporary shapes for preview
    function drawTemporaryShape(startCol, startRow, endCol, endRow) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2 / scale; // Adjust line width for zoom
        ctx.setLineDash([5 / scale, 5 / scale]); // Adjust dash for zoom

        const startX = startCol * TILE_SIZE;
        const startY = startRow * TILE_SIZE;
        const endX = endCol * TILE_SIZE;
        const endY = endRow * TILE_SIZE;

        if (currentShape === 'rectangle') {
            const width = endX - startX + TILE_SIZE;
            const height = endY - startY + TILE_SIZE;
            ctx.strokeRect(startX, startY, width, height);
        } else if (currentShape === 'circle') {
            const centerX = startCol * TILE_SIZE + TILE_SIZE / 2;
            const centerY = startRow * TILE_SIZE + TILE_SIZE / 2;

            const currentMouseX = endCol * TILE_SIZE + TILE_SIZE / 2;
            const currentMouseY = endRow * TILE_SIZE + TILE_SIZE / 2;

            const radius = Math.sqrt(Math.pow(currentMouseX - centerX, 2) + Math.pow(currentMouseY - centerY, 2));

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.setLineDash([]); // Reset line dash
    }


    function handleCanvasMouseUp(e) {
        isPanning = false; // Reset panning state

        if (!isDrawing) return;

        if (currentTool === 'polygon' && startPoint && palette.selectedTile) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Convert screen coordinates to canvas coordinates
            const x = (mouseX - offsetX) / scale;
            const y = (mouseY - offsetY) / scale;

            const endCol = Math.floor(x / TILE_SIZE);
            const endRow = Math.floor(y / TILE_SIZE);

            if (currentShape === 'rectangle') {
                applyRectangleToMap(startPoint.col, startPoint.row, endCol, endRow, palette.selectedTile);
            } else if (currentShape === 'circle') {
                applyCircleToMap(startPoint.col, startPoint.row, endCol, endRow, palette.selectedTile);
            }
            redrawCanvas(); // Redraw canvas to show permanent shape
        }

        isDrawing = false;
        startPoint = null;
    }

    function handleCanvasMouseLeave() {
        isPanning = false; // Reset panning state if mouse leaves canvas

        if (isDrawing && currentTool === 'polygon') {
            redrawCanvas(); // Clear temporary shape if polygon tool was active
        }
        isDrawing = false;
        startPoint = null;
    }

    function drawOnCanvas(x, y) {
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== palette.selectedTile) {
                mapData[row][col] = palette.selectedTile;
                redrawCanvas();
                saveState(); // Save state after drawing
            }
        }
    }

    function eraseOnCanvas(x, y) { // Added eraseOnCanvas function
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== null) { // Only erase if there's a tile
                mapData[row][col] = null;
                redrawCanvas();
                saveState(); // Save state after erasing
            }
        }
    }

    function selectTool(tool) {
        currentTool = tool;
        btnToolDraw.classList.toggle('selected', tool === 'draw');
        btnToolFill.classList.toggle('selected', tool === 'fill');
        btnToolErase.classList.toggle('selected', tool === 'erase');
        btnToolPolygon.classList.toggle('selected', tool === 'polygon');

        if (tool === 'polygon') {
            polygonShapeSelection.style.display = 'flex'; // Show shape selection
            selectShape(currentShape); // Ensure current shape is selected
        } else {
            polygonShapeSelection.style.display = 'none'; // Hide shape selection
        }
    }

    function selectShape(shape) {
        currentShape = shape;
        btnShapeRectangle.classList.toggle('selected', shape === 'rectangle');
        btnShapeCircle.classList.toggle('selected', shape === 'circle');
    }

    function loadTiles(e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const newTiles = JSON.parse(event.target.result);
                palette.clear();
                newTiles.forEach(tile => palette.addTile(tile));
            } catch (error) {
                alert('Error parsing JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // Undo/Redo functions
    function saveState() {
        // If historyPointer is not at the end, clear future states
        if (historyPointer < history.length - 1) {
            history = history.slice(0, historyPointer + 1);
        }

        // Add current mapData to history
        history.push(JSON.parse(JSON.stringify(mapData)));
        historyPointer++;

        // Trim history if it exceeds MAX_HISTORY_SIZE
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift(); // Remove the oldest state
            historyPointer--;
        }
    }

    function undo() {
        if (historyPointer > 0) {
            historyPointer--;
            mapData = JSON.parse(JSON.stringify(history[historyPointer]));
            redrawCanvas();
        }
    }

    function redo() {
        if (historyPointer < history.length - 1) {
            historyPointer++;
            mapData = JSON.parse(JSON.stringify(history[historyPointer]));
            redrawCanvas();
        }
    }

    function handleCanvasWheel(e) {
        e.preventDefault(); // Prevent page scrolling

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - offsetX) / scale;
        const canvasY = (mouseY - offsetY) / scale;

        let newScale = scale;
        if (e.deltaY < 0) {
            newScale *= zoomFactor; // Zoom in
        } else {
            newScale /= zoomFactor; // Zoom out
        }

        // Clamp scale to reasonable limits (e.g., 0.1 to 10)
        newScale = Math.max(0.1, Math.min(newScale, 10.0));

        // Adjust offsets to keep the mouse position fixed on the canvas
        offsetX = mouseX - canvasX * newScale;
        offsetY = mouseY - canvasY * newScale;

        scale = newScale;
        redrawCanvas();
    }

    // Event Listeners
    btnNewTile.addEventListener('click', showModal);
    btnCancelTile.addEventListener('click', hideModal);
    btnCreateTile.addEventListener('click', createTile);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    canvas.addEventListener('wheel', handleCanvasWheel); // Add wheel event listener
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click context menu
    // Removed keyboard event listeners for spacebar panning

    // Keyboard event listeners for Undo/Redo
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault(); // Prevent browser's default undo
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault(); // Prevent browser's default redo
            redo();
        }
    });

    btnToolDraw.addEventListener('click', () => selectTool('draw'));
    btnToolFill.addEventListener('click', () => selectTool('fill'));
    btnToolErase.addEventListener('click', () => selectTool('erase'));
    btnToolPolygon.addEventListener('click', () => selectTool('polygon')); // Event listener for polygon tool
    btnShapeRectangle.addEventListener('click', () => selectShape('rectangle')); // Event listener for rectangle shape
    btnShapeCircle.addEventListener('click', () => selectShape('circle'));     // Event listener for circle shape
    btnLoad.addEventListener('click', () => fileLoader.click());
    btnLoadPalette.addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (e) => loadTiles(e));
    btnApplyCanvasSize.addEventListener('click', resizeCanvas);
    btnClearAll.addEventListener('click', clearAllCanvas);
    btnExportText.addEventListener('click', exportMapAsText); // Added event listener for Clear All button


    // Initial setup
    setupCanvas();
    selectTool('draw'); // Default tool

    console.log("Map editor initialized.");
});

    function handleCanvasWheel(e) {
        e.preventDefault(); // Prevent page scrolling

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - offsetX) / scale;
        const canvasY = (mouseY - offsetY) / scale;

        let newScale = scale;
        if (e.deltaY < 0) {
            newScale *= zoomFactor; // Zoom in
        } else {
            newScale /= zoomFactor; // Zoom out
        }

        // Clamp scale to reasonable limits (e.g., 0.1 to 10)
        newScale = Math.max(0.1, Math.min(newScale, 10.0));

        // Adjust offsets to keep the mouse position fixed on the canvas
        offsetX = mouseX - canvasX * newScale;
        offsetY = mouseY - canvasY * newScale;

        scale = newScale;
        redrawCanvas();
    }