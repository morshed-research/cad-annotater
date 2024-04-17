$(document).ready(function() {
    // Initialize canvas and setup environment
    var canvas = new fabric.Canvas('canvas', {
        width: window.innerWidth,
        height: window.innerHeight,
        selection: true,
    });

    // Initially disable the delete button
    $('#delete-button').prop('disabled', true);
    
    var img_scale, offsetX, offsetY;
    var nodes = [], edges = [];
    var firstNode = null, tempLine = null, nodeIdCounter = 0;
    var isDragging = false, editMode = false;
    var DRAG_THRESHOLD = 10, clickStartX = 0, clickStartY = 0;
    var backgroundImage = canvas.backgroundImage;

    $('#edit-button').prop('disabled', true);

    // Node creation function  
    function addNode(left, top, nodeId, initialName = "Node") {

        // Retrieve the current node size from the slider
        var size = parseInt(document.getElementById('node-size-slider').value, 10);


        var circle = new fabric.Circle({
            id: nodeId,
            radius: size,
            fill: 'red',
            left: 0,  // Position inside group
            top: 0,   // Position inside group
            originX: 'center',
            originY: 'center',
            hasBorders: false,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            selectable: true,
            hoverCursor: 'pointer',

        });

        var text = new fabric.Text(initialName, {
            fontSize: size,
            left: 0,  // Position inside group
            top: 25,  // Position inside group, below the circle
            originX: 'center',
            originY: 'top',
            hasBorders: false,
            hasControls: false,
            selectable: false,
        });
    
        var group = new fabric.Group([circle, text], {
            id: nodeId,
            name: initialName,
            left: left,  // Position on canvas
            top: top,    // Position on canvas
            originX: 'center',
            originY: 'center',
            selectable: true,
            lockMovementX: true,
            lockMovementY: true,
        });

        // Hovering blue border effect
        group.on('mouseover', () => {
            circle.set({ stroke: 'blue', strokeWidth: 3 });
            canvas.renderAll();
        });

        group.on('mouseout', () => {
            circle.set({ stroke: '', strokeWidth: 1 });
            canvas.renderAll();
        });
    
        // Name changing on doubleclick
        group.on('mousedblclick', () => {
            var newName = prompt("Enter the new name:", group.item(1).text);
            if (newName !== null && newName.trim() !== "") {
                // Directly access and update the text object within the group
                group.set({ name: newName });
                group.item(1).set({ text: newName });
                group.addWithUpdate();
                canvas.renderAll();
                // Update Nodes Backend
                var groupIndex = nodes.findIndex(g => g.id === group.id);
                nodes[groupIndex] = group;
            }
        });
    
        canvas.add(group);
        nodes.push(group);
    }

    // Edge creation function
    function createEdge(node1, node2) {
        // Check if an edge between these nodes already exists
        var edgeExists = edges.some(edge => {
            return (edge.node1.id === node1.id && edge.node2.id === node2.id) || 
                   (edge.node1.id === node2.id && edge.node2.id === node1.id);
        });
    
        if (tempLine && !edgeExists) {
            tempLine.set({
                node1: node1,
                node2: node2,
                selectable: true,
                lockMovementX: true,
                lockMovementY: true,
                hasControls: false,
            });
            tempLine.moveTo(1);
            edges.push(tempLine);
        } else {
            canvas.remove(tempLine);
        }
    }

    // Delete selected objects
    function deleteSelectedObject() {
        if (!editMode) return;
    
        var activeObject = canvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject(obj => {
                    removeNodeAndConnectedEdges(obj);
                });
            } else {
                removeNodeAndConnectedEdges(activeObject);
            }
    
            canvas.discardActiveObject();
            canvas.requestRenderAll();
        }
    }
    
    function removeNodeAndConnectedEdges(obj) {
        if (obj.type === 'group') {
            // Remove connected edges from frontend
            edges.forEach(edge => {
                if (edge.node1 === obj || edge.node2 === obj) {
                    canvas.remove(edge)
                } 
            });
            // Remove node from backend
            nodes = nodes.filter(n => n !== obj);
        } 
        // Remove node/edge from frontend and edges from backend 
        canvas.remove(obj)
        edges = edges.filter(edge => edge.node1 !== obj && edge.node2 !== obj);
    }
    

    // Event handlers
    $('#upload-file').change(handleFileUpload);
    $('#edit-button').click(toggleEditMode);
    canvas.on({ 'mouse:down': handleMouseDown, 'mouse:move': handleMouseMove, 'mouse:up': handleMouseUp });

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = e => loadImageOnCanvas(e.target.result);
        reader.readAsDataURL(file);
    }

    function loadImageOnCanvas(dataUrl) {
        fabric.Image.fromURL(dataUrl, (oImg) => {
            var scale = Math.min(canvas.width / oImg.width, canvas.height / oImg.height);
            img_scale = scale;
            oImg.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, selectable: false, evented: false });
            canvas.clear();
            canvas.add(oImg);
            oImg.sendToBack();
            canvas.renderAll();
            $('#edit-button').prop('disabled', false);
        }, { crossOrigin: 'anonymous' });
    }

    function toggleEditMode() {
        editMode = !editMode;
        $('#edit-button').text(editMode ? 'Stop Editing' : 'Start Editing');
    }

    function handleMouseDown(options) {
        clickStartX = options.e.clientX;
        clickStartY = options.e.clientY;
        isDragging = false;

        if (editMode && options.target && options.target.type === 'group') {
            initiateTempLine(options);
        }
    }

    function handleMouseMove(options) {
        if (Math.abs(options.e.clientX - clickStartX) > DRAG_THRESHOLD || Math.abs(options.e.clientY - clickStartY) > DRAG_THRESHOLD) {
            isDragging = true;
        }

        if (tempLine) {
            tempLine.set({ x2: options.pointer.x, y2: options.pointer.y });
            canvas.renderAll();
        }
    }

    function handleMouseUp(options) {
        finalizeTempLine(options);
    }

    function initiateTempLine(options) {
        if (!options.target || options.target.type !== 'group') return;
    
        firstNode = options.target;  // The group is the first node
        var circle = firstNode.item(0);  // Access the circle inside the group
    
        tempLine = new fabric.Line([firstNode.left, firstNode.top, options.pointer.x + circle.radius, options.pointer.y + circle.radius], {
            stroke: '#000',
            strokeWidth: 3,
            selectable: false,
        });
        canvas.add(tempLine);
    }

    function finalizeTempLine(options) {
        if (tempLine) {
            var targetNode = findTargetNode(tempLine.x2, tempLine.y2);  // Find the target node group

            if (targetNode && targetNode !== firstNode) {
                createEdge(firstNode, targetNode);
            } else {
                canvas.remove(tempLine);
            }
            tempLine = null;
            firstNode = null;
        } else if (editMode && !isDragging && !options.target) {
            addNode(options.pointer.x, options.pointer.y, ++nodeIdCounter);
        }
        isDragging = false;
    }

    function findTargetNode(x, y) {
        return nodes.find(group => isPointInCircle(x, y, group));
    }

    function isPointInCircle(x, y, group) {
        var circle = group.item(0);  // Access the circle inside the group
        var circleCenterX = group.left +  circle.radius;
        var circleCenterY = group.top - circle.radius;

        return Math.sqrt((x - circleCenterX) ** 2 + (y - circleCenterY) ** 2) <= 2 * circle.radius;
    }


    // Download JSON representation of the graph
    $('#download-button').click(function() {
        // Only calculate the offsets and scaling if a background image is present
        // Assuming uniform scaling for X and Y
        var scale = backgroundImage ? backgroundImage.scaleX : 1; 
        offsetX = backgroundImage ? backgroundImage.left * scale : 0;
        offsetY = backgroundImage ? backgroundImage.top * scale : 0;
        alert(img_scale + " vs " + scale)

        var graph = { nodes: [], edges: [], scale: [img_scale, scale] };

        nodes.forEach(node => {
            // Adjust node coordinates relative to the image's top-left corner
            var xRelativeToImage = (node.left - offsetX) / img_scale;
            var yRelativeToImage = (node.top - offsetY) / img_scale;

            graph.nodes.push({
                id: node.id, // Node id
                name: node.name,
                x: xRelativeToImage,  // X-coordinate relative to the image
                y: yRelativeToImage,  // Y-coordinate relative to the image
            });
        });

        edges.forEach(edge => {
            graph.edges.push({
                id_1: edge.node1.id,
                id_2: edge.node2.id
            });
        });
        
        console.log(graph)
        // Create a Blob from the JSON data
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(graph));
        var downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "graph_data.json");
        document.body.appendChild(downloadAnchorNode); // Required for Firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Function to handle JSON upload
    function handleJSONUpload(e) {
        var file = e.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function(event) {
            try {
                var jsonObj = JSON.parse(event.target.result);
                loadGraphFromJSON(jsonObj);
            } catch (error) {
                alert('Error parsing JSON: ' + error);
            }
        };
        reader.readAsText(file);
    }

    // Function to load graph from JSON object
    function loadGraphFromJSON(jsonObj) {
        // canvas.clear();
        nodes = [];  // Clear existing nodes array
        edges = [];  // Clear existing edges array
        
        var scale = backgroundImage ? backgroundImage.scaleX : 1; 
        offsetX = backgroundImage ? backgroundImage.left * scale : 0;
        offsetY = backgroundImage ? backgroundImage.top * scale : 0;

        jsonObj.nodes.forEach(node => {
            addNode(node.x * img_scale + offsetX, node.y * img_scale + offsetY, node.id, node.name);
        });

        jsonObj.edges.forEach(edge => {
            var node1 = nodes.find(n => n.id === edge.id_1);
            var node2 = nodes.find(n => n.id === edge.id_2);
            if (node1 && node2) {
                var edge = new fabric.Line([node1.left, node1.top, node2.left, node2.top], {
                    node1: node1,
                    node2: node2,
                    selectable: true,
                    lockMovementX: true,
                    lockMovementY: true,
                    hasControls: false,
                    stroke: '#000',
                    strokeWidth: 3,
                    selectable: false,
                });

                canvas.add(edge);
                edge.moveTo(1);
                edges.push(edge);
            }
        });
        canvas.renderAll();
    }
    document.getElementById('upload-json').addEventListener('change', handleJSONUpload);

    // Delete node using button or keyboard
    document.getElementById('delete-button').addEventListener('click', deleteSelectedObject);
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            deleteSelectedObject();
        }
    });

    // Node Size Button
    document.getElementById('node-size-slider').addEventListener('input', function(e) {
        var newScale = parseInt(e.target.value, 10) / 20; // Assuming 20 is the original node size for scale 1.
    
        // Update each group's scale
        nodes.forEach(nodeGroup => {
            nodeGroup.scaleX = newScale;
            nodeGroup.scaleY = newScale;
            nodeGroup.setCoords(); // Update the group's coordinates after scaling
        });
    
        canvas.renderAll(); // Refresh the canvas to display the updated sizes
    });
    
    // Edit button 
    function toggleEditMode() {
        editMode = !editMode;
        $('#edit-button').text(editMode ? 'Stop Editing' : 'Edit');
    
        // Toggle button colors and activation based on edit mode
        if (editMode) {
            $('#edit-button').addClass('edit-active'); // Turn edit button red
            $('#delete-button').removeClass('delete-inactive').addClass('delete-active').prop('disabled', false); // Enable and turn delete button red
        } else {
            $('#edit-button').removeClass('edit-active'); // Revert edit button to green
            $('#delete-button').addClass('delete-inactive').removeClass('delete-active').prop('disabled', true); // Disable and revert delete button to grey
        }
    }
    
    
});