// This is a fork of GoldenScheme for me to play around with
// GoldenScheme can be found here: http://goldenscheme.accelart.jp/
// License of this source is BSD License.

var GoldenScheme = function() {
	// Get debug DOM
	this.debugDom = document.getElementById("debug");
	if (this.debugDom == null) {
		this.debugDom = document.body;
	}
};
GoldenScheme.prototype = {
	run: function(src) {
		var ary = src.match(/\(|\)|[^\(\)\t\r\n ]+/g);

		// 構文木作成: Syntax tree creation
		var tree = [];
		tree.vars = this.funcs;
		this.parse(tree, ary, 1);
		
		// 構文木実行: Syntax tree execution
		var result = this.evalExpr(tree);
		// 結果表示: Result representation
		this.printDebug(result);
	},
	
	parse: function(root, ary, pos) {
		for(var i=pos; i<ary.length; i++) {
			switch(ary[i]) {
				case "(":
					var aryChild = [];
					aryChild.parent = root;
					root.push(aryChild);
					i = this.parse(aryChild, ary, i + 1);
					break;
				case ")":
					return i;
				default:
					if(ary[i].match(/^-?[0-9]+$/)) {
						root.push(parseInt(ary[i]));
					} else {
						root.push(this.createSymbol(ary[i], root));
					}
			}
		}
	},
	
	createSymbol : function(name, parent) {
		return {
			type: "symbol",
			name: name,
			parent: parent
		}
	},
	
	evalExpr: function(expr) {
		// プリミティブ型ならば値を返す: Returns a value if it is a primitive type
		if(!(typeof(expr) == "object")) {
			return expr;
		}
		
		// シンボルの場合、親を順次捜していく: In the case of a symbol, the parent is searched sequentially.
		if(expr.type == "symbol") {
			for(var f = expr; f != null; f = f.parent) {
				if("vars" in f && expr.name in f.vars) {
					console.log("[evalExpr] Eval symbol : " + expr.name);
					return this.evalExpr(f.vars[expr.name]);
				}
			}
			throw "[evalExpr] Cannot find symbol : " + expr.name;
		}
		
		// ここまで来たらS式(配列)でないといけない: If it comes so far, it must be an S expression (array)
		if(!(expr instanceof Array)) {
			throw "[evalExpr] Illegal type. Must be S-expression.";
		}

		// 特殊関数は中身を評価しない: Special functions do not evaluate content
		if(this.aryContains(this.lateEvalFunc, expr[0].name)) {
			return this.funcs[expr[0].name].call(this, expr);
		}
		
		// 引数を評価: Evaluate argument
		var ary = new Array(expr.length);
		for(var i=0; i<expr.length; i++) {
			ary[i] = this.evalExpr(expr[i]);
		}
		
		var execFunc = ary[0];
		// ネイティブ関数の実行: Native function execution
		if(typeof(execFunc) == "function") {
			return execFunc.call(this, ary);
		}
		
		// lambda の実行: Run lambda
		if(execFunc instanceof Array && execFunc[0].name == "lambda") {
			// 元の変数を保存
			var origVars = execFunc.vars;
			// 変数の初期化
			execFunc.vars = {};
			for(var i=1; i < ary.length; i++) {
				execFunc.vars[execFunc[1][i - 1].name] = ary[i];
			}
			// 実行
			var result = null;
			for(var i=2; i<execFunc.length; i++) {
				execFunc[i].parent = execFunc;
				result = this.evalExpr(execFunc[i]);
			}
			// 元の変数を復元
			execFunc.vars = origVars;
			return result;
		}
		throw "[evalExpr] Cannot eval expr : " + expr;
	},
	
	aryContains: function(ary, nail) {
		for(var i=0; i<ary.length; i++) {
			if(ary[i] == nail) return true;
		}
		return false;
	},
	
	printDebug : function(str) {
		var div = document.createElement("div");
		var text = document.createTextNode(str);
		div.appendChild(text);
		this.debugDom.appendChild(div);
	},
	
	lateEvalFunc : ["quote", "define", "lambda", "if", "set!", "let"]
}

GoldenScheme.prototype.funcs = {
	begin (ary) {
		return ary[ary.length - 1];
	},
	
	lambda (ary) {
		return ary;
	},
	
	define (ary) {
		console.log("[define]");
		for(var f = ary; f != null; f = f.parent) {
			if(!("vars" in f)) continue;
			if(ary[1].type == "symbol") {
				console.log("[define] symbole name = " + ary[1].name);
				f.vars[ary[1].name] = ary[2];
				return ary[1].name;
			} else if(ary[1] instanceof Array) {
				// 省略記法: Abbreviation
				var arg = [];
				for(var i=1; i < ary[1].length; i++) {
					arg.push(ary[1][i]);
				}
				var f2 = [
					{
						type: "symbol",
						name: "lambda"
					},
					arg,
					ary[2]
				];
				f2[0].parent = f2;
				f2.parent = ary;
				f.vars[ary[1][0].name] = f2; 
				return ary[1][0].name;
			} else {
				throw "[define] Illegal arguments for define";
			}
		}
		throw "[define] Cannot find vars";
	},
	
	let (ary) {
		console.log("[let]");
		// 変数名と変数の値: Variable name and variable value
		var varNameList = [];
		var varValueList = [];
		for(var i=0; i < ary[1].length; i++) {
			varNameList.push(ary[1][i][0]);
			varValueList.push(ary[1][i][1]);
		}
		// 変数の初期化: Variable initialization
		if(!("vars" in ary)) {
			ary.vars = {};
		}
		for(var i=0; i<varNameList.length; i++) {
			if(!(varNameList[i].name in ary.vars)) {
				ary.vars[varNameList[i].name] = varValueList[i];
			}
		}
		// 関数の実行: Function execution
		var result;
		for(var i=2; i<ary.length; i++) {
			ary[i].parent = ary;
			result = this.evalExpr(ary[i]);
		}
		return result;
	},
	
	["set!"] (ary) {
		console.log("[set!]");
		for(var f = ary; f != null; f = f.parent) {
			if("vars" in f && ary[1].type == "symbol" && ary[1].name in f.vars) {
				f.vars[ary[1].name] = this.evalExpr(ary[2]);
				console.log("[set!] name = " + ary[1].name + ", value = " + f.vars[ary[1].name]);
				return ary[1].name;
			}
		}
		throw "[set!] Illegal Argument";
	},
	
	if (ary) {
		if(this.evalExpr(ary[1])) {
			return this.evalExpr(ary[2]);
		} else {
			return this.evalExpr(ary[3]);
		}
	},
	
	cons (ary) {
		var cons = [ary[1], ary[2]];
		cons.type = "cons";
		return cons;
	},
	
	quote (ary) {
		var quote = ary[1];
		quote.type = "quote";
		return quote;
	},
	
	car: ary => ary[1][0],
	cdr: ary => ary[1][ary.length - 1],
	
	list: ary => {
		var top = [];
		top.type = "cons";
		var cons = top;
		for(var i=1; i<ary.length; i++) {
			cons.push(ary[i]);
			if(i < ary.length - 1) {
				var consNext = [];
				consNext.type = "cons";
				cons.push(consNext);
				cons = consNext;
			}
		}
		return top;
	},
	
	"+": ary => {
		var sum = 0;
		for(var i=1; i < ary.length; i++) {
			console.log("[+] ary[i] = " + ary[i]);
			sum += ary[i];
		}
		console.log("[+] sum = " + sum);
		return sum;
	},
	
	"-": ary => {
		if(ary.length == 1) return -ary[1];
		var sum = ary[1];
		for(var i=2; i < ary.length; i++) {
			sum -= ary[i];
		}
		return sum;
	},
	
	"*": ary => ary[1] * ary[2],
	"/": ary => ary[1] / ary[2],
	expt: ary => ary[1] ** ary[2],
	"=": ary => ary[1] == ary[2],	
	"<" : ary => ary[1] < ary[2],
	">" : ary => ary[1] > ary[2],
	not : ary => !ary[1],
	
	display (ary) {this.printDebug(ary[1])}
};
