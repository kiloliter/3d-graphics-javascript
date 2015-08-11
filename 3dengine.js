// This code is public domain.

$(document).ready(function(){
	var screenWidth = 320;
	var screenHeight = 240;
	var cameraMatrix = null;
	function getCrossProduct (vector1, vector2) {
		var result = [0,0,0];
		result[0] = vector1[1] * vector2[2] - vector1[2] * vector2[1];
		result[1] = vector1[2] * vector2[0] - vector1[0] * vector2[2];
		result[2] = vector1[0] * vector2[1] - vector1[1] * vector2[0];
		return result;
	}
	function getUnitVector(vector) {
		var magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
		return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
	}
	function getDotProduct (vector1, vector2) {
		return vector1[0] * vector2[0] + vector1[1] * vector2[1] + vector1[2] * vector2[2];
	}

	function getAngle(cameraLocation, cameraDirection, object) {
		var vectorToObject = [object[0] - cameraLocation[0], object[1] - cameraLocation[1], object[2] - cameraLocation[2]];
		var vectorToObject = getUnitVector(vectorToObject);
		var cameraDirection = getUnitVector(cameraDirection);
		var dotProduct = getDotProduct(vectorToObject, cameraDirection);
		return Math.acos(dotProduct);
	}

	function matrixMultiply(matrix1, matrix2) {
		var resultColumns = matrix2[0].length;
		var resultRows = matrix1.length;
		var result = new Array(resultRows);
		for (var i = 0;i < resultRows;i++)
			result[i] = new Array(resultColumns);
		for (var row = 0;row < resultRows;row++){
			for (var column = 0;column < resultColumns;column++) {
				result[row][column] = 0;
				for (i = 0;i < matrix1[0].length;i++) {
					result[row][column] += matrix1[row][i] * matrix2[i][column];
				}
			}
		}
		return result;
	}

	var playerHeight = 30;
	var lightSource = [6000, 6000, 0];
	var cameraX = 100;
	var cameraY = playerHeight;
	var cameraZ = 100;
	var cameraJumpSpeed = 0;
	var cameraAngleHorizontal = 0;
	var cameraAngleVertical = 0;
	var canvas = document.getElementById("3dEngineCanvas");
	var context = canvas.getContext('2d');

	// collision detection object
	function GameObject () {
		this.xLength = 70;
		this.yLength = 70;
		this.zLength = 70;
		this.x = 0;
		this.y = 0;
		this.z = 0;
	}

	GameObject.prototype.isWithin = function(x, y, z) {
		if (x > this.x &&
			x < this.x + this.xLength && 
			y > this.y &&
			y < this.y + this.yLength && 
			z > this.z &&
			z < this.z + this.zLength) {
				return true;
			}
		return false;
	}

	gameObjects = [];

	function BspTreeElement () {
		this.pointArray = [];
		this.bspFrontMesh = null;
		this.bspBackMesh = null;
		this.originalMesh = null;
	}

	// this is to set up the bsp tree
	BspTreeElement.prototype.addElementToTree = function(element) {
		var splitResult = element.splitElementByPlane(this);
		if (splitResult[0] != null) {
			// front
			if (this.bspFrontMesh == null) {
				this.bspFrontMesh = splitResult[0];
			}
			else {
				this.bspFrontMesh.addElementToTree(splitResult[0]);
			}
		}
		if (splitResult[1] != null) {
			// back
			if (this.bspBackMesh == null) {
				this.bspBackMesh = splitResult[1];
			}
			else {
				this.bspBackMesh.addElementToTree(splitResult[1]);
			}
		}
	}

	BspTreeElement.prototype.splitElementByPlane = function(splittingPlane) {
		var a = splittingPlane.originalMesh.normal[0];
		var b = splittingPlane.originalMesh.normal[1];
		var c = splittingPlane.originalMesh.normal[2];
		var d = splittingPlane.originalMesh.normal[0] * -splittingPlane.pointArray[0][0] + splittingPlane.originalMesh.normal[1] * -splittingPlane.pointArray[0][1] + splittingPlane.originalMesh.normal[2] * -splittingPlane.pointArray[0][2];

		var frontPolygon = new BspTreeElement();
		frontPolygon.originalMesh = this.originalMesh;
		var backPolygon = new BspTreeElement();
		backPolygon.originalMesh = this.originalMesh;
		var frontPolygonHasNonEdgePoints = false;	// these two variables will tell if the polygon consists only of points that are directly on the edge of the plane, in which case we don't need to return it
		var backPolygonHasNonEdgePoints = false;
		nextPoint = 0;
		for (var i = 0;i < this.pointArray.length;i++) {
			nextPoint++;
			if (nextPoint == this.pointArray.length)
				nextPoint = 0;
			isPointOutside = isPointOutsidePlane(this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2], a, b, c, d);
			isNextPointOutside = isPointOutsidePlane(this.pointArray[nextPoint][0], this.pointArray[nextPoint][1], this.pointArray[nextPoint][2], a, b, c, d);
			if (isPointOutside > 0) {
				frontPolygonHasNonEdgePoints = true;
				frontPolygon.pointArray.push([this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2]]);
			}
			else if (isPointOutside < 0) {
				backPolygonHasNonEdgePoints = true;
				backPolygon.pointArray.push([this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2]]);
			}
			else {
				frontPolygon.pointArray.push([this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2]]);
				backPolygon.pointArray.push([this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2]]);
			}
			if ((isPointOutside < 0 && isNextPointOutside > 0 ) || (isPointOutside > 0 && isNextPointOutside < 0)) {
				result = findIntersectionForSplitting(this.pointArray[i][0], this.pointArray[i][1], this.pointArray[i][2],this.pointArray[nextPoint][0],this.pointArray[nextPoint][1],this.pointArray[nextPoint][2], a, b, c, d);
				frontPolygon.pointArray.push([result[0], result[1], result[2]]);
				backPolygon.pointArray.push([result[0], result[1], result[2]]);
			}
		}
		if (frontPolygonHasNonEdgePoints == false && backPolygonHasNonEdgePoints == false) {		// If a polygon is on exactly the same plane as the splitting polygon, we just include it on the back side. Even though it doesn't really matter, we have to pick one side.
			backPolygon = null;
		}
		else {
			if (frontPolygon.length == 0 || frontPolygonHasNonEdgePoints == false)
				frontPolygon = null;
			if (backPolygon.length == 0 || backPolygonHasNonEdgePoints == false)
				backPolygon = null;
		}
		return [backPolygon, frontPolygon];
	}

	BspTreeElement.prototype.addElementToSortedListRecursively = function() {
		var plane = [this.originalMesh.normal[0], this.originalMesh.normal[1], this.originalMesh.normal[2], this.originalMesh.normal[0] * -this.pointArray[0][0] + this.originalMesh.normal[1] * -this.pointArray[0][1] + this.originalMesh.normal[2] * -this.pointArray[0][2]];
		var backMesh = isPointOutsidePlane(cameraX, cameraY, cameraZ, plane[0], plane[1], plane[2], plane[3]);
		if (backMesh < 0) {
			if (this.bspFrontMesh != null)
				this.bspFrontMesh.addElementToSortedListRecursively();
			bspElementDrawingOrder.push(this);
			if (this.bspBackMesh != null)
				this.bspBackMesh.addElementToSortedListRecursively();
		}
		else {
			if (this.bspBackMesh != null)
				this.bspBackMesh.addElementToSortedListRecursively();
			bspElementDrawingOrder.push(this);
			if (this.bspFrontMesh != null)
				this.bspFrontMesh.addElementToSortedListRecursively();
		}

	}

	BspTreeElement.prototype.setElementFromMesh = function(mesh) {
		this.pointArray = mesh.pointArray;
		this.originalMesh = mesh;
	}

	BspTreeElement.prototype.getClippedPolygon = function() {
		var polygon = [];
		for (var i = 0;i < this.pointArray.length;i++) {
			polygon.push(this.getTransformedPoint(i));
		}
		var clippedPolygon = new ClippedPolygon();
		clippedPolygon.clippedPolygon = clipPolygon(polygon);
		if (clippedPolygon.clippedPolygon == null) {
			return null;
		}
		clippedPolygon.mesh = this.originalMesh;
		clippedPolygon.element = this;
		var sum = 0;
		for (var i = 0;i < clippedPolygon.clippedPolygon.length;i++) {
			sum += Math.sqrt(clippedPolygon.clippedPolygon[i][0] * clippedPolygon.clippedPolygon[i][0] + clippedPolygon.clippedPolygon[i][1] * clippedPolygon.clippedPolygon[i][1] + clippedPolygon.clippedPolygon[i][2] * clippedPolygon.clippedPolygon[i][2]);
		}
		clippedPolygon.distance = sum / clippedPolygon.clippedPolygon.length;
		return clippedPolygon;
	}

	BspTreeElement.prototype.getTransformedPoint = function(i) {
		rotationResultVector = matrixMultiply(cameraMatrix, [[this.pointArray[i][0], 0], [this.pointArray[i][1], 0], [this.pointArray[i][2], 0], [1, 0]]);
		return [rotationResultVector[0][0], rotationResultVector[1][0], rotationResultVector[2][0]];
	}

	bspElementDrawingOrder = [];

	function Mesh () {
		this.pointArray = [];
		this.color = [0,0,0];
		this.bspFrontMesh = null;
		this.bspBackMesh = null;
		this.normal = 0;
	}

	Mesh.prototype.computeNormal = function() {
		this.normal = getUnitVector(getCrossProduct (
		[this.pointArray[1][0] - this.pointArray[0][0], this.pointArray[1][1] - this.pointArray[0][1], this.pointArray[1][2] - this.pointArray[0][2]],
		[this.pointArray[2][0] - this.pointArray[0][0], this.pointArray[2][1] - this.pointArray[0][1], this.pointArray[2][2] - this.pointArray[0][2]]));
		this.shadeColor = getAngle([this.pointArray[0][0], this.pointArray[0][1], this.pointArray[0][2]], this.normal, lightSource);

		this.backNormal = getUnitVector(getCrossProduct (
		[this.pointArray[2][0] - this.pointArray[0][0], this.pointArray[2][1] - this.pointArray[0][1], this.pointArray[2][2] - this.pointArray[0][2]],
		[this.pointArray[1][0] - this.pointArray[0][0], this.pointArray[1][1] - this.pointArray[0][1], this.pointArray[1][2] - this.pointArray[0][2]]));
		this.backNormal[0] = this.backNormal[0];
		this.backNormal[1] = this.backNormal[1];
		this.backNormal[2] = this.backNormal[2];
		this.backShadeColor = getAngle([this.pointArray[0][0], this.pointArray[0][1], this.pointArray[0][2]], this.backNormal, lightSource);
	}

	meshes = [];

	function ClippedPolygon (clippedPolygon, distance, mesh) {
		this.clippedPolygon = clippedPolygon;
		this.distance = distance;
		this.mesh = mesh;
	}

	function findIntersection (x1, y1, z1, x2, y2, z2, a, b, c) {
		var t = (-a * x1 - b * y1 - c * z1) / (a * x2 - a * x1 + b * y2 - b * y1 + c * z2 - c * z1);
		var x = x1 + t * (x2 - x1);
		var y = y1 + t * (y2 - y1);
		var z = z1 + t * (z2 - z1);
		return [x, y, z];
	}

	function findIntersectionForSplitting (x1, y1, z1, x2, y2, z2, a, b, c, d) {
		var t = (-a * x1 - b * y1 - c * z1 - d) / (a * x2 - a * x1 + b * y2 - b * y1 + c * z2 - c * z1);
		var x = x1 + t * (x2 - x1);
		var y = y1 + t * (y2 - y1);
		var z = z1 + t * (z2 - z1);
		return [x, y, z];
	}

	function isPointOutsidePlaneOnOrigin(x1, y1, z1, x, y, z) {
		if (x * x1 + y * y1 + z * z1 > 0)
			return false;
		return true;
	}

	function isPointOutsidePlane(x1, y1, z1, a, b, c, d) {
		return (a * x1 + b * y1 + c * z1 + d);
	}

	function clipPolygonByPlane (polygon, x, y, z) {
		var clippedPolygon = [];
		nextPoint = 0;
		for (var i = 0;i < polygon.length;i++) {
			nextPoint++;
			if (nextPoint == polygon.length)
				nextPoint = 0;
			isPointOutside = isPointOutsidePlaneOnOrigin(polygon[i][0], polygon[i][1], polygon[i][2], x, y, z);
			isNextPointOutside = isPointOutsidePlaneOnOrigin(polygon[nextPoint][0], polygon[nextPoint][1], polygon[nextPoint][2], x, y, z);
			if (isPointOutside == false) {
				clippedPolygon.push(polygon[i]);
			}
			if ((isPointOutside == true && isNextPointOutside == false) || (isPointOutside == false && isNextPointOutside == true)) {
				result = findIntersection(polygon[i][0], polygon[i][1], polygon[i][2],polygon[nextPoint][0],polygon[nextPoint][1],polygon[nextPoint][2], x, y, z)
				clippedPolygon.push([result[0], result[1], result[2]]);
			}
		}
		if (clippedPolygon.length == 0)
			return null;
		return clippedPolygon;
	}

	// clip each polygon by the view frustum
	function clipPolygon (polygon) {
		var clippedPolygon = clipPolygonByPlane(polygon, 1, 0, -1);		// left
		if (clippedPolygon == null)
			return null;
		clippedPolygon = clipPolygonByPlane(clippedPolygon, -1, 0, -1);	// right
		if (clippedPolygon == null)
			return null;
		clippedPolygon = clipPolygonByPlane(clippedPolygon, 0, 1, -.75);	// top
		if (clippedPolygon == null)
			return null;
		clippedPolygon = clipPolygonByPlane(clippedPolygon, 0, -1, -.75);	// bottom
		if (clippedPolygon == null)
			return null;
		return clippedPolygon;
	}

	function putTriangle (vertices, size, xOffset, yOffset, zOffset, color) {
		mesh = new Mesh();
		mesh.pointArray.push([(vertices[0][0] * size) + xOffset, (vertices[0][1] * size) + yOffset, (vertices[0][2] * size) + zOffset]);
		mesh.pointArray.push([(vertices[1][0] * size) + xOffset, (vertices[1][1] * size) + yOffset, (vertices[1][2] * size) + zOffset]);
		mesh.pointArray.push([(vertices[2][0] * size) + xOffset, (vertices[2][1] * size) + yOffset, (vertices[2][2] * size) + zOffset]);
		mesh.color = color;
		meshes.push(mesh);
	}
	
	function putCube (x, y, z, size, color) {
		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z - 30 * size]);
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z + 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z - 30 * size]);
		mesh.color = color;
		meshes.push(mesh);

		mesh = new Mesh();
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z - 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z - 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z + 30 * size]);
		mesh.color = color;
		meshes.push(mesh);

		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z - 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z - 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z - 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z - 30 * size]);
		mesh.color = color;
		meshes.push(mesh);

		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z + 30 * size]);
		mesh.color = color;
		meshes.push(mesh);

		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z - 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z - 30 * size]);
		mesh.color = color;
		meshes.push(mesh);

		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y - 30 * size, z - 30 * size]);
		mesh.pointArray.push([x - 30 * size, y - 30 * size, z - 30 * size]);
		mesh.color = color;
		meshes.push(mesh);
		gameObjects.push(new GameObject());
		gameObjects[gameObjects.length - 1].x = x - 30 * size - 5;
		gameObjects[gameObjects.length - 1].y = y - 30 * size - 5;
		gameObjects[gameObjects.length - 1].z = z - 30 * size - 5;
		gameObjects[gameObjects.length - 1].xLength = size * 30 * 2 + 10;
		gameObjects[gameObjects.length - 1].yLength = size * 30 * 2 + 10;
		gameObjects[gameObjects.length - 1].zLength = size * 30 * 2 + 10;
	}

	function putBuilding (x, y, z, size, height, color) {
		for (var i = 0;i < height;i++) {
			putCube (x, y + size * 60 * i + 30, z, size, color);
		}
	}

	function putFloor (x, y, z, size, color) {
		mesh = new Mesh();
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z + 30 * size]);
		mesh.pointArray.push([x + 30 * size, y + 30 * size, z - 30 * size]);
		mesh.pointArray.push([x - 30 * size, y + 30 * size, z - 30 * size]);
		mesh.color = color;
		meshes.push(mesh);
		gameObjects.push(new GameObject());
		gameObjects[gameObjects.length - 1].x = x - 30 * size - 5;
		gameObjects[gameObjects.length - 1].y = y - 30 * size - 5;
		gameObjects[gameObjects.length - 1].z = z - 30 * size - 5;
		gameObjects[gameObjects.length - 1].xLength = size * 30 * 2 + 10;
		gameObjects[gameObjects.length - 1].yLength = size * 30 * 2 + 10;
		gameObjects[gameObjects.length - 1].zLength = size * 30 * 2 + 10;
	}

	var keyState = [];
	playerSpeed = 10;
	function update() {
		var deltaX = 0;
		var deltaY = 0;
		var deltaZ = 0;
		if (keyState[87]){
			deltaZ = -Math.cos(cameraAngleHorizontal) * playerSpeed;
			deltaX = -Math.sin(cameraAngleHorizontal) * playerSpeed;
		}
		if (keyState[65]){
			deltaZ = -Math.cos(cameraAngleHorizontal - Math.PI * .5) * playerSpeed;
			deltaX = -Math.sin(cameraAngleHorizontal - Math.PI * .5) * playerSpeed;
		}
		if (keyState[83]){
			deltaZ = Math.cos(cameraAngleHorizontal) * playerSpeed;
			deltaX = Math.sin(cameraAngleHorizontal) * playerSpeed;
		}
		if (keyState[68]){
			deltaZ = -Math.cos(cameraAngleHorizontal - Math.PI * 1.5) * playerSpeed;
			deltaX = -Math.sin(cameraAngleHorizontal - Math.PI * 1.5) * playerSpeed;
		}
		if (keyState[32]){ // jump
			var canJump = false;
			for (var i = 0;i < gameObjects.length;i++) {
				if (gameObjects[i].isWithin(cameraX, cameraY - 2 - playerHeight, cameraZ)) {
					canJump = true;
					break;
				}
			}
			if (canJump)
				cameraJumpSpeed = 20;
		}
		deltaY = cameraJumpSpeed;
		cameraJumpSpeed -= 2;
		var shouldMoveZ = true;
		var shouldMoveY = true;
		var shouldMoveX = true;
		for (var i = 0;i < gameObjects.length;i++) {
			if (gameObjects[i].isWithin(cameraX + deltaX, cameraY, cameraZ)) {
				shouldMoveX = false;
			}
			if (gameObjects[i].isWithin(cameraX, cameraY, cameraZ + deltaZ)) {
				shouldMoveZ = false;
			}
			if (gameObjects[i].isWithin(cameraX, cameraY + deltaY - playerHeight, cameraZ)) {
				shouldMoveY = false;
				cameraJumpSpeed = -2;
			}
		}
		if (shouldMoveX == true)
				cameraX += deltaX;
		if (shouldMoveY == true)
				cameraY += deltaY;
		if (shouldMoveZ == true)
				cameraZ += deltaZ;
			

		context.fillStyle="#7ec0ee";		// blue sky
		context.fillRect(0,0,320, 240);

		var verticalRotationMatrix = [
			[1, 0, 0, 1],
			[0, Math.cos(cameraAngleVertical), -Math.sin(cameraAngleVertical), 1],
			[0, Math.sin(cameraAngleVertical), Math.cos(cameraAngleVertical),  1],
			[0, 0, 0, 1]];
		var horizontalRotationMatrix = [
			[Math.cos(cameraAngleHorizontal), 0, -Math.sin(cameraAngleHorizontal), 1],
			[0, 1, 0, 1],
			[Math.sin(cameraAngleHorizontal), 0, Math.cos(cameraAngleHorizontal),  1],
			[0, 0, 0, 1]];
		var translationMatrix = [
			[1, 0, 0, -cameraX],
			[0, 1, 0, -cameraY],
			[0, 0, 1, -cameraZ],
			[0, 0, 0, 1]];

		var resultMatrix = matrixMultiply(horizontalRotationMatrix, translationMatrix);
		cameraMatrix = matrixMultiply(verticalRotationMatrix, resultMatrix);

		var clippedPolygons = [];
		bspElementDrawingOrder = [];
		topElementInTree.addElementToSortedListRecursively();
		for (var i = bspElementDrawingOrder.length - 1;i >= 0;i--) {
			var tmp = bspElementDrawingOrder[i].getClippedPolygon();
			if (tmp != null) {
				clippedPolygons.push(tmp);
			}
		}
		if (clippedPolygons == null)
			return;

		context.lineWidth = 1;
		for (var i = 0;i < clippedPolygons.length;i++) {
			context.beginPath();
			context.moveTo(160 * (clippedPolygons[i].clippedPolygon[0][0] / clippedPolygons[i].clippedPolygon[0][2]) + 160, 160 * (clippedPolygons[i].clippedPolygon[0][1]  / clippedPolygons[i].clippedPolygon[0][2]) + 120);
			for (var j = 1;j < clippedPolygons[i].clippedPolygon.length;j++) {
				context.lineTo(160 * (clippedPolygons[i].clippedPolygon[j][0] / clippedPolygons[i].clippedPolygon[j][2]) + 160, 160 * (clippedPolygons[i].clippedPolygon[j][1]  / clippedPolygons[i].clippedPolygon[j][2]) + 120);

			}
			context.closePath();
			var angleToCamera = getAngle([clippedPolygons[i].mesh.pointArray[0][0], clippedPolygons[i].mesh.pointArray[0][1], clippedPolygons[i].mesh.pointArray[0][2]], clippedPolygons[i].mesh.normal, [cameraX, cameraY, cameraZ]);
			if ( angleToCamera > Math.PI / 2) {
				var angle = clippedPolygons[i].mesh.shadeColor;
			}
			else {
				var angle = clippedPolygons[i].mesh.backShadeColor;
			}
			angle /= Math.PI * 2;
			angle *= .8;
			angle += .2;
			context.fillStyle= 'rgb(' + Math.floor(clippedPolygons[i].mesh.color[0] * angle) + ', ' + Math.floor(clippedPolygons[i].mesh.color[1] * angle) + ',' + Math.floor(clippedPolygons[i].mesh.color[2] * angle) + ')';
			context.fill();
			context.strokeStyle= context.fillStyle;
			context.stroke();
		}
	}

	function keyDownHandler(event)
	{
		keyState[event.keyCode || event.which] = true;
		return;
	}

	function keyUpHandler(event)
	{
		keyState[event.keyCode || event.which] = false;
		return
	}

	document.addEventListener("keydown",keyDownHandler, false);	
	document.addEventListener("keyup",keyUpHandler, false);	

	function setupPointerLock() {

		document.addEventListener('pointerlockchange', changeCallback, false);
		document.addEventListener('mozpointerlockchange', changeCallback, false);
		document.addEventListener('webkitpointerlockchange', changeCallback, false);

		$(canvas).click(function () {
			var canvasElement = $(canvas).get()[0];
			canvasElement.requestPointerLock = canvasElement.requestPointerLock ||
					canvasElement.mozRequestPointerLock ||
					canvasElement.webkitRequestPointerLock;

			canvasElement.requestPointerLock();
		});
	}

	function changeCallback(e) {
		var canvasElement = $(canvas).get()[0];
		if (document.pointerLockElement === canvasElement ||
				document.mozPointerLockElement === canvasElement ||
				document.webkitPointerLockElement === canvasElement) {

			document.addEventListener("mousemove", moveCallback, false);
		} else {

			document.removeEventListener("mousemove", moveCallback, false);

			entryCoordinates = {x:-1, y:-1};
		}
	};

	function getPosition(canvas, event) {
		var x = new Number();
		var y = new Number();

		if (event.x != undefined && event.y != undefined) {
			x = event.x;
			y = event.y;
		}
		else
		{
			x = event.clientX + document.body.scrollLeft +
					document.documentElement.scrollLeft;
			y = event.clientY + document.body.scrollTop +
					document.documentElement.scrollTop;
		}

		x -= canvas.offsetLeft;
		y -= canvas.offsetTop;

		return {x:x, y:y};
	}

	var entryCoordinates = {x:-1, y:-1};
	function moveCallback(e) {

		var canvasElement = $(canvas).get()[0];
		var ctx = canvasElement.getContext('2d');

		if (entryCoordinates.x == -1) {
			entryCoordinates = getPosition(canvasElement, e);
		}

		var movementX = e.movementX ||
				e.mozMovementX ||
				e.webkitMovementX ||
				0;

		var movementY = e.movementY ||
				e.mozMovementY ||
				e.webkitMovementY ||
				0;

		entryCoordinates.x = entryCoordinates.x + movementX;
		entryCoordinates.y = entryCoordinates.y + movementY;

		if (entryCoordinates.x > $('#pointerLock').width() -65) {
			entryCoordinates.x = $('#pointerLock').width()-65;
		} else if (entryCoordinates.x < 0) {
			entryCoordinates.x = 0;
		}

		if (entryCoordinates.y > $('#pointerLock').height() - 85) {
			entryCoordinates.y = $('#pointerLock').height() - 85;
		} else if (entryCoordinates.y < 0) {
			entryCoordinates.y = 0;
		}

		var direction = 0;
		if (movementX > 0) {
			direction = 1;
		} else if (movementX < 0) {
			direction = -1;
		}
		cameraAngleHorizontal += movementX / 80;
		cameraAngleVertical += movementY / 80;
		if(cameraAngleVertical >= Math.PI / 2)  // make sure we can't look too far up or down, or else we'd go all the way around and start looking a the world upside down
			cameraAngleVertical = Math.PI / 2 - .001;
		if(cameraAngleVertical <= -Math.PI / 2)
			cameraAngleVertical = -Math.PI / 2 + .001;
	}

	// create the game map
	map = [
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 3, 0, 0, 2, 2, 0, 0, 0, 0, 1],
		[1, 0, 3, 0, 2, 2, 2, 0, 0, 0, 0, 1],
		[1, 0, 3, 0, 2, 2, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1]];

	for (var x = 0; x < map.length;x++){
		for (var y = 0; y < map[x].length;y++){
			if (map[x][y] == 1) {
				putCube (x * 60, 30, y * 60, 1, [100,100,150]);
			}
			else if (map[x][y] == 2) {
				putFloor (x * 60, -30, y * 60, 1, [0,0,255]);
			}
			else if (map[x][y] == 3) {
				putBuilding (x * 60, 0, y * 60, 1, 21, [0,0,250]);
			}
			else {
				putFloor (x * 60, -30, y * 60, 1, [0,255,0]);
			}
		}
	}

	putCube (lightSource[0], lightSource[1], lightSource[2], 20, [255,255,0]);		// the "sun"

	for (var i = 0;i < 20;i++){
		putCube (Math.random() * 3000 - 1500,Math.random() * 1000 + 200,Math.random() * 3000 - 1500, 1, [255,255,255]);
	}
	
	for (var i = 0;i < meshes.length;i++) {
		meshes[i].computeNormal();
	}

	// set up the bsp tree
	var topElementInTree = new BspTreeElement();
	topElementInTree.setElementFromMesh(meshes[0]);
	for (var i = 1;i < meshes.length;i++) {
		var newElement = new BspTreeElement();
		newElement.setElementFromMesh(meshes[i]);
		topElementInTree.addElementToTree(newElement);
	}

	setupPointerLock();

	setInterval(update, 10);
});
