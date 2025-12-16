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

    const TILE_SIZE = 32;
    const MAP_WIDTH = 800;
    const MAP_HEIGHT = 608;
    const MAP_COLS = MAP_WIDTH / TILE_SIZE;
    const MAP_ROWS = MAP_HEIGHT / TILE_SIZE;
    let mapData = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(null));

    let currentTool = 'draw'; // 'draw' or 'fill'
    let currentShape = 'rectangle'; // 'rectangle' or 'circle' - for polygon tool

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

    // Initialize canvas
    function setupCanvas() {
        canvas.width = MAP_WIDTH;
        canvas.height = MAP_HEIGHT;
        redrawCanvas();
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        drawGrid();
        for (let row = 0; row < MAP_ROWS; row++) {
            for (let col = 0; col < MAP_COLS; col++) {
                const tile = mapData[row][col];
                if (tile) {
                    drawTile(col * TILE_SIZE, row * TILE_SIZE, tile);
                }
            }
        }
    }

    // Draw grid lines
    function drawGrid() {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;

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
    }

    function applyCircleToMap(startCol, startRow, endCol, endRow, tile) {
        const centerX = startCol;
        const centerY = startRow;

        // Calculate radius based on distance from center to end point
        const radius = Math.floor(Math.sqrt(Math.pow(endCol - centerX, 2) + Math.pow(endRow - centerY, 2)));

        if (radius <= 0) return;

        // Function to set a tile, with bounds checking
        const setTile = (col, row) => {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                mapData[row][col] = tile;
            }
        };

        // Midpoint circle algorithm to draw the perimeter and mark points for filling
        const fillableRows = new Map(); // Map to store min/max columns for each row to fill

        let x = radius;
        let y = 0;
        let err = 0;

        while (x >= y) {
            // Store points for filling
            // Octant 1, 2, 7, 8
            if (fillableRows.has(centerY + y)) {
                fillableRows.get(centerY + y).min = Math.min(fillableRows.get(centerY + y).min, centerX - x);
                fillableRows.get(centerY + y).max = Math.max(fillableRows.get(centerY + y).max, centerX + x);
            } else {
                fillableRows.set(centerY + y, { min: centerX - x, max: centerX + x });
            }
            if (fillableRows.has(centerY - y)) {
                fillableRows.get(centerY - y).min = Math.min(fillableRows.get(centerY - y).min, centerX - x);
                fillableRows.get(centerY - y).max = Math.max(fillableRows.get(centerY - y).max, centerX + x);
            } else {
                fillableRows.set(centerY - y, { min: centerX - x, max: centerX + x });
            }

            // Octant 3, 4, 5, 6
            if (fillableRows.has(centerY + x)) {
                fillableRows.get(centerY + x).min = Math.min(fillableRows.get(centerY + x).min, centerX - y);
                fillableRows.get(centerY + x).max = Math.max(fillableRows.get(centerY + x).max, centerX + y);
            } else {
                fillableRows.set(centerY + x, { min: centerX - y, max: centerX + y });
            }
            if (fillableRows.has(centerY - x)) {
                fillableRows.get(centerY - x).min = Math.min(fillableRows.get(centerY - x).min, centerX - y);
                fillableRows.get(centerY - x).max = Math.max(fillableRows.get(centerY - x).max, centerX + y);
            } else {
                fillableRows.set(centerY - x, { min: centerX - y, max: centerX + y });
            }

            y++;
            err += 1 + 2 * y;
            if (2 * (err - x) + 1 > 0) {
                x--;
                err += 1 - 2 * x;
            }
        }

        // Fill the interior of the circle
        for (const [row, colRange] of fillableRows.entries()) {
            for (let col = colRange.min; col <= colRange.max; col++) {
                setTile(col, row);
            }
        }
    }


    let isDrawing = false;
    let startPoint = null; // Added for polygon tool

    function handleCanvasMouseDown(e) {
        if (!palette.selectedTile && currentTool !== 'erase') return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw') {
            isDrawing = true;
            drawOnCanvas(e);
        } else if (currentTool === 'fill') {
            if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
                floodFill(col, row, palette.selectedTile);
            }
        } else if (currentTool === 'erase') { // Added erase tool logic
            isDrawing = true;
            eraseOnCanvas(e);
        } else if (currentTool === 'polygon') { // Added polygon tool logic
            isDrawing = true;
            startPoint = { col, row };
        }
    }

    function handleCanvasMouseMove(e) {
        if (!isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (currentTool === 'draw' && palette.selectedTile) {
            drawOnCanvas(e);
        } else if (currentTool === 'erase') {
            eraseOnCanvas(e);
        } else if (currentTool === 'polygon' && startPoint) { // Preview for polygon tool
            redrawCanvas(); // Clear canvas and redraw existing map
            drawTemporaryShape(startPoint.col, startPoint.row, col, row);
        }
    }

    // Helper function to draw temporary shapes for preview
    function drawTemporaryShape(startCol, startRow, endCol, endRow) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line for preview

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
        if (!isDrawing) return;

        if (currentTool === 'polygon' && startPoint && palette.selectedTile) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
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
        if (isDrawing && currentTool === 'polygon') {
            redrawCanvas(); // Clear temporary shape if polygon tool was active
        }
        isDrawing = false;
        startPoint = null;
    }

    function drawOnCanvas(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== palette.selectedTile) {
                mapData[row][col] = palette.selectedTile;
                redrawCanvas();
            }
        }
    }

    function eraseOnCanvas(e) { // Added eraseOnCanvas function
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            if (mapData[row][col] !== null) { // Only erase if there's a tile
                mapData[row][col] = null;
                redrawCanvas();
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

    // Event Listeners
    btnNewTile.addEventListener('click', showModal);
    btnCancelTile.addEventListener('click', hideModal);
    btnCreateTile.addEventListener('click', createTile);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    btnToolDraw.addEventListener('click', () => selectTool('draw'));
    btnToolFill.addEventListener('click', () => selectTool('fill'));
    btnToolErase.addEventListener('click', () => selectTool('erase'));
    btnToolPolygon.addEventListener('click', () => selectTool('polygon')); // Event listener for polygon tool
    btnShapeRectangle.addEventListener('click', () => selectShape('rectangle')); // Event listener for rectangle shape
    btnShapeCircle.addEventListener('click', () => selectShape('circle'));     // Event listener for circle shape
    btnLoad.addEventListener('click', () => fileLoader.click());
    btnLoadPalette.addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (e) => loadTiles(e));


    // Initial setup
    setupCanvas();
    selectTool('draw'); // Default tool

    console.log("Map editor initialized.");
});
