/* 
    Promise 的api
    1. resolve 改变当前Promise状态为成功
    2. reject 改变当前Promise状态为失败
    3. then 当Promise状态改变后执行then里面的异步方法
    4. finally 无论Promise的状态是成功还是失败都会被执行 可以在finally对象下链式调用then拿到当前Promise对象的返回值
    5. catch 捕获Promise 执行中发生的错误
    6. all 用来解决异步并法问题，通过调用顺序，也会返回相同顺序的结果。
    7. resolve(静态) 将给定的值返回一个Promise对象并包裹给定的值
*/

/*
    Promise 状态的全局变量
    PENDING： 等待
    FULFILLED： 成功
    REJECTED： 失败
*/
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
    constructor(executor) {
        // 捕获执行器中发生的错误,并在下一个then中调用错误回调
        try {
            executor(this.resolve, this.reject)
        } catch (error) {
            this.reject(error)
        }
    }

    // 当前状态默认为等待 当Promise里调用了resolve 或 reject 改变状态
    status = PENDING
    // 成功的返回值
    successValue = undefined
    // 失败的返回值
    errorValue = undefined
    // 成功回调， 如果存在异步回调则保存在数组里面
    successCallback = []
    // 失败回调， 如果存在异步回调则保存在数组里面
    failCallback = []

    resolve = value => {
        // 如果状态不是等待就不用执行下文了
        if(this.status !== PENDING) return
        // 改变状态为成功
        this.status = FULFILLED
        // 保存成功返回的值
        this.successValue = value
        // TODO
        while(this.successCallback.length) this.successCallback.shift()()
    }

    reject = value => {
        if(this.status !== PENDING) return
        this.status = REJECTED
        this.errorValue = value
        // TODO
        while(this.failCallback.length) this.failCallback.shift()()
    }

    then(successCallback, failCallback) {
            // then 的链式调用中 前面的then不传回调函数则返回的结果会直接传给最后一个有回调函数的then相当于之前没回调函数的then传入了 value => value 所以当回调为空的时候将我们的函数放入进去
            successCallback = successCallback ? successCallback : successValue => successValue
            // 一样链式调用不传入失败回调则会一直往下传，传入给有错误回调的函数里
            failCallback = failCallback ? failCallback : errorValue => { throw errorValue }
            // 执行then函数时创建新的MyPrmose，达成链式调用then的方法
            let promise2 = new MyPromise((resolve, reject) => {
                // 当状态值为成功时
                if(this.status === FULFILLED) {
                    // 因为要方式出现原Promise调用原Promise的方式，所以要拿到新创建的promise2，当调用传参在内部，只能创建个新的宏任务等待上轮宏任务完成就可以拿到promise2了
                    setTimeout(_ => {
                        try {
                            // then回调执行返回的内容
                            let result = successCallback(this.successValue)
                            // 注释查看原函数
                            resolvePromise(promise2, result, resolve, reject)
                        } catch (error) {
                            // 捕获then方法里成功回调发生的错误并返回给下一个then的错误回调函数
                            reject(error)
                        }
                    }, 0)
                }

                // 当状态值为失败时，内部作用和上部分基本一致
                if(this.status === REJECTED) {
                    setTimeout(_ => {
                        try {
                            let result = failCallback(this.errorValue)
                            resolvePromise(promise2, result, resolve, reject)
                        } catch (error) {
                            reject(error)
                        }
                    })
                }

                // 当状态值为等待时，将成功或失败回调存储起来
                if(this.status === PENDING) {
                    this.successCallback.push(_ => {
                        setTimeout(_ => {
                            try {
                                let result = successCallback(this.successValue)
                                resolvePromise(promise2, result, resolve, reject)
                            } catch (error) {
                                reject(error)
                            }
                        }, 0)
                    })
                    this.failCallback.push(_ => {
                        setTimeout(_ => {
                            try {
                                let result = failCallback(this.errorValue)
                                resolvePromise(promise2, result, resolve, reject)
                            } catch (error) {
                                reject(error)
                            }
                        })
                    })
                }
            })

        return promise2
    }

    // 接收一个回调函数
    finally(callback) {
        // 使用this.then拿到状态，并返回promise对象达到链式调用
        return this.then(value => {
            // 借用resolve方法，
            // 判断callback返回什么值，
            // 如果是普通值则直接转为promise对象直接返回， 如果是promise对象则等待完成在返回
            // 等待callback()里的代码完全执行完在返回value
            return MyPromise.resolve(callback()).then(() => value)
        }, err => {
            return MyPromise.resolve(callback()).then(() => { throw err })
        })
    }

    catch(failCallback) {
        // 直接调用then方法并只传入错误回调来回去错误返回值
        return this.then(undefined, failCallback)
    }

    /*
        内部接受一个数组（数组内部可以是普通值或promise方法），
        当数组内的所有Promise状态都是成功则返回一个promise对象就可以用then方法获取返回值，
        当有一个失败则返回第一个失败的原因
    */
    static all(array) {
        // 保存返回值
        let result = []
        let index = 0
        return new MyPromise((resolve, reject) => {
            function addData(key, value) {
                result[key] = value
                index ++
                // 处理异步代码，每当添加一个返回值时index+1，直到传入数组长度和index一样就可以返回
                if(index === array.length) {
                    resolve(result)
                }
            }
            // 循环数组判断当中的每一项是普通值还是pormise对象
            for(let i = 0; i < array.length; i ++) {
                let current = array[i]
                if(current instanceof MyPromise) {
                    // promise 对象
                    // 获取他的返回结果并放入返回数组中
                    current.then(val => addData(i, val), err => reject(err))
                } else {
                    // 普通值 直接放入放回数组中
                    addData(i, array[i])
                }
            }
        })
    }

    // 接收一个参数 参数可以是普通值或promise对象
    // 如果是普通值则新建个MyPromise对象并把返回值resolve出去
    // 如果是promise对象则直接返回即可
    static resolve(value) {
        if(value instanceof MyPromise) return value
        return new MyPromise(resolve => resolve(value)) 
    }
}

/*
    查看then方法里的值返回的是Promise 还是 普通值。如果是普通值则直接返回，如果是Promise则根据返回的结果 决定调用resolve 还是调用reject
    1. promise2 新创建的Promise
    2. result then回调执行返回的内容
    3. resolve 。。。。
    4. reject 。。。。
*/ 
function resolvePromise(promise2, result, resolve, reject) {
    // 原Promise方法中 then返回的新Promise方法不可以作为返回值返回自己会报错
    if(promise2 === result) {
        return reject(new TypeError('Chaining cycle detected for promise #<Promise>'))
    }

    // 判断是否为Promise对象
    if(result instanceof MyPromise) {
        // Promise对象根据返回结果直接 resolve reject
        // x.then(value => resolve(value), value => reject(value));
        result.then(resolve, reject)
    } else {
        // 普通值直接返回
        resolve(result)
    }
}

module.exports = MyPromise
