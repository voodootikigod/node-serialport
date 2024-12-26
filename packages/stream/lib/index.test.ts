/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from 'sinon'
import { randomBytes } from 'crypto'
import { MockBinding, MockBindingInterface } from '@serialport/binding-mock'
import { DisconnectedError, OpenOptions, SerialPortStream } from './'
import { assert } from '../../../test/assert'

const sandbox = sinon.createSandbox()
describe('SerialPort', () => {
  const openOpts: OpenOptions<MockBindingInterface> = { path: '/dev/exists', baudRate: 9600, binding: MockBinding }

  beforeEach(() => {
    MockBinding.createPort('/dev/exists', { echo: true })
  })

  afterEach(() => {
    sandbox.restore()
    MockBinding.reset()
  })

  describe('constructor', () => {
    describe('autoOpen', () => {
      it('opens the port automatically', done => {
        new SerialPortStream(openOpts, err => {
          assert.isNull(err)
          done()
        })
      })

      it('emits the open event', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', done)
      })

      it("doesn't open if told not to", done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.on('open', () => {
          done(new Error("this shouldn't be opening"))
        })
        process.nextTick(done)
      })
    })

    // needs to be passes the callback to open
    it('passes the error to the callback when an bad port is provided', done => {
      new SerialPortStream({ ...openOpts, path: '/bad/port' }, err => {
        assert.instanceOf(err, Error)
        done()
      })
    })

    // is this a test for open?
    it('emits an error when an bad port is provided', done => {
      const port = new SerialPortStream({ ...openOpts, path: '/bad/port' })
      port.once('error', err => {
        assert.instanceOf(err, Error)
        done()
      })
    })

    it('throws an error when bindings are missing', done => {
      try {
        new SerialPortStream({ ...openOpts, binding: undefined } as any)
      } catch (err) {
        assert.instanceOf(err, Error)
        done()
      }
    })

    it('throws an error when no port is provided', done => {
      try {
        new SerialPortStream({ ...openOpts, path: '' })
      } catch (err) {
        assert.instanceOf(err, Error)
        done()
      }
    })

    it('errors with a non number baudRate even with a callback', done => {
      try {
        new SerialPortStream({ path: '/dev/exists', baudRate: 'whatever' } as any, () => {})
      } catch (err) {
        assert.instanceOf(err, Error)
        done()
      }
    })

    it('throws an error when given bad baudrate option even with a callback', () => {
      assert.throws(() => {
        new SerialPortStream({ path: 'foobar', baudrate: 9600 } as any, () => {})
      })
    })

    it('errors with a non number baudRate', done => {
      try {
        new SerialPortStream({ path: '/dev/exists', baudRate: 'whatever' } as any)
      } catch (err) {
        assert.instanceOf(err, Error)
        done()
      }
    })

    it('sets valid flow control individually', done => {
      const options = {
        ...openOpts,
        xon: true,
        xoff: true,
        xany: true,
        rtscts: true,
        autoOpen: false,
      }
      const port = new SerialPortStream(options)
      assert.isTrue(port.settings.xon)
      assert.isTrue(port.settings.xoff)
      assert.isTrue(port.settings.xany)
      assert.isTrue(port.settings.rtscts)
      done()
    })
  })

  describe('property', () => {
    describe('.baudRate', () => {
      it('is a read only property set during construction', () => {
        const port = new SerialPortStream({
          ...openOpts,
          autoOpen: false,
        })
        assert.equal(port.baudRate, 9600)
        try {
          ;(port as any).baudRate = 14400
        } catch (e) {
          assert.instanceOf(e, TypeError)
        }
        assert.equal(port.baudRate, 9600)
      })
    })

    describe('.path', () => {
      it('is a read only property set during construction', () => {
        const port = new SerialPortStream({
          ...openOpts,
          autoOpen: false,
        })
        assert.equal(port.path, '/dev/exists')
        try {
          ;(port as any).path = 'foo'
        } catch (e) {
          assert.instanceOf(e, TypeError)
        }
        assert.equal(port.path, '/dev/exists')
      })
    })

    describe('.isOpen', () => {
      it('is a read only property', () => {
        const port = new SerialPortStream({
          ...openOpts,
          autoOpen: false,
        })
        assert.equal(port.isOpen, false)
        try {
          ;(port as any).isOpen = 'foo'
        } catch (e) {
          assert.instanceOf(e, TypeError)
        }
        assert.equal(port.isOpen, false)
      })

      it('returns false when the port is created', done => {
        const port = new SerialPortStream({
          ...openOpts,
          autoOpen: false,
        })
        assert.isFalse(port.isOpen)
        done()
      })

      it('returns false when the port is opening', done => {
        const port = new SerialPortStream<MockBindingInterface>({
          ...openOpts,
          autoOpen: false,
        })
        sandbox.stub(port.settings.binding, 'open').callsFake(() => {
          assert.isTrue(port.opening)
          assert.isFalse(port.isOpen)
          done()
          return Promise.resolve({} as any)
        })
        port.open()
      })

      it('returns true when the port is open', done => {
        const port = new SerialPortStream(openOpts, () => {
          assert.isTrue(port.isOpen)
          done()
        })
      })

      it('returns false when the port is closing', done => {
        const port = new SerialPortStream(openOpts, () => {
          sandbox.stub((port as any).port, 'close').callsFake(async () => {
            assert.isFalse(port.isOpen)
            done()
          })
          port.close()
        })
      })

      it('returns false when the port is closed', done => {
        const port = new SerialPortStream(openOpts, () => {
          port.close()
        })
        port.on('close', () => {
          assert.isFalse(port.isOpen)
          done()
        })
      })
    })
  })

  describe('instance method', () => {
    describe('#open', () => {
      it('passes the open options to the bindings without the stream stuff', done => {
        sandbox.stub(MockBinding, 'open').callsFake(((opt: any) => {
          assert.deepEqual(opt, {
            path: '/dev/exists',
            baudRate: 9600,
          })
          done()
        }) as any)
        new SerialPortStream(openOpts)
      })

      it('calls back an error when opening an invalid port', done => {
        const port = new SerialPortStream({ ...openOpts, path: '/dev/unhappy', autoOpen: false })
        port.open(err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('emits data after being reopened', done => {
        const data = Buffer.from('Howdy!')
        const port = new SerialPortStream<MockBindingInterface>(openOpts, () => {
          port.close(() => {
            port.open(() => {
              port.port?.emitData(data)
            })
          })
          port.once('data', res => {
            assert.deepEqual(res, data)
            done()
          })
        })
      })

      it('cannot be opened again after open', done => {
        const port = new SerialPortStream(openOpts, () => {
          port.open(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('cannot be opened while opening', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.open(err => {
          assert.isNull(err)
        })
        port.open(err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('allows opening after an open error', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        const stub = sandbox.stub(port.settings.binding, 'open').callsFake(() => {
          return Promise.reject(new Error('Haha no'))
        })
        port.open(err => {
          assert.instanceOf(err, Error)
          stub.restore()
          port.open(done)
        })
      })
    })

    describe('#write', () => {
      it('writes to the bindings layer', done => {
        const data = Buffer.from('Crazy!')
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          port.write(data, () => {
            assert.deepEqual(data, port.port!.lastWrite)
            done()
          })
        })
      })

      it('converts strings to buffers', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          const data = 'Crazy!'
          port.write(data, () => {
            const lastWrite = port.port!.lastWrite
            assert.deepEqual(Buffer.from(data), lastWrite)
            done()
          })
        })
      })

      it('converts strings with encodings to buffers', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          const data = 'C0FFEE'
          port.write(data, 'hex', () => {
            const lastWrite = port.port!.lastWrite
            assert.deepEqual(Buffer.from(data, 'hex'), lastWrite)
            done()
          })
        })
      })

      it('converts arrays to buffers', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          const data = [0, 32, 44, 88]
          port.write(data, () => {
            const lastWrite = port.port!.lastWrite
            assert.deepEqual(Buffer.from(data), lastWrite)
            done()
          })
        })
      })

      it('queues writes when the port is closed', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.write('data', done)
        port.open()
      })

      it('combines many writes into one', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.open(() => {
          const spy = sinon.spy(port.port!, 'write')
          port.cork()
          port.write('abc')
          port.write(Buffer.from('123'), () => {
            assert.equal(spy.callCount, 1)
            assert.deepEqual(port.port!.lastWrite, Buffer.from('abc123'))
            done()
          })
          port.uncork()
        })
      })
    })

    describe('#close', () => {
      it('emits a close event for writing consumers', done => {
        const port = new SerialPortStream(openOpts, () => {
          port.on('close', () => {
            assert.isFalse(port.isOpen)
            done()
          })
          port.close()
        })
      })

      it('emits an "end" event for reading consumers when endOnClose is true', done => {
        const port = new SerialPortStream({ ...openOpts, endOnClose: true })
        port.on('open', () => {
          port.on('end', () => {
            assert.isFalse(port.isOpen)
            done()
          })
          port.close()
        })
      })

      it('doesn\'t emit an "end" event for reading consumers when endOnClose is false', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          port.on('end', () => {
            done(new Error('Should not have ended'))
          })
          port.close(() => done())
        })
      })

      it('has a close callback', done => {
        const port = new SerialPortStream(openOpts, () => {
          port.close(() => {
            assert.isFalse(port.isOpen)
            done()
          })
        })
      })

      it('emits the "close" event and runs the callback', done => {
        let called = 0
        const doneIfTwice = function () {
          called++
          if (called === 2) {
            return done()
          }
        }
        const port = new SerialPortStream(openOpts, () => {
          port.close(doneIfTwice)
        })
        port.on('close', doneIfTwice)
      })

      it('emits an "error" event or error callback but not both', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        let called = 0
        const doneIfTwice = function (err: Error | null) {
          assert.instanceOf(err, Error)
          called++
          if (called === 2) {
            return done()
          }
        }
        port.on('error', doneIfTwice)
        port.close()
        port.close(doneIfTwice)
      })

      it('emits a "close" event after being reopened', done => {
        const port = new SerialPortStream(openOpts, () => {
          const closeSpy = sandbox.spy()
          port.on('close', closeSpy)
          port.close(() => {
            port.open(() => {
              port.close(() => {
                assert.isTrue(closeSpy.calledTwice)
                done()
              })
            })
          })
        })
      })

      it('errors when the port is not open', done => {
        const cb = function () {}
        const port = new SerialPortStream({ ...openOpts, autoOpen: false }, cb)
        port.close(err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'close').callsFake(async () => {
            throw new Error('like tears in the rain')
          })
          port.close(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('handles errors in event', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'close').callsFake(async () => {
            throw new Error('attack ships on fire off the shoulder of Orion')
          })
          port.close()
        })
        port.on('error', err => {
          assert.instanceOf(err, Error)
          done()
        })
      })
    })

    describe('#update', () => {
      it('errors when the port is not open', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.update({ baudRate: 2 }, err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('errors when called with bad options', done => {
        const port = new SerialPortStream(openOpts)
        port.once('open', () => {
          port.update({} as any, err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('can be called without callback', done => {
        const port = new SerialPortStream(openOpts, () => {
          assert.equal(port.baudRate, 9600)
          port.update({ baudRate: 14400 })
          done()
        })
      })

      it('sets the baudRate on the port', done => {
        const port = new SerialPortStream(openOpts, () => {
          assert.equal(port.baudRate, 9600)
          port.update({ baudRate: 14400 }, err => {
            assert.equal(port.baudRate, 14400)
            assert.isNull(err)
            done()
          })
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'update').callsFake(() => {
            return Promise.reject(new Error('like tears in the rain'))
          })
          port.update({} as any, err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('handles errors in event', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'update').callsFake(() => {
            return Promise.reject(new Error('attack ships on fire off the shoulder of Orion'))
          })
          port.update({} as any)
        })
        port.on('error', err => {
          assert.instanceOf(err, Error)
          done()
        })
      })
    })

    describe('#set', () => {
      it('errors when serialport not open', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.set({}, err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('sets the flags on the ports bindings', done => {
        const settings = {
          brk: true,
          cts: true,
          dtr: true,
          rts: true,
        }

        const port = new SerialPortStream(openOpts, () => {
          const spy = sandbox.spy(port.port!, 'set')
          port.set(settings, err => {
            assert.isNull(err)
            assert(spy.calledWith(settings))
            done()
          })
        })
      })

      it('sets missing options to default values', done => {
        const settings = {
          cts: true,
          rts: false,
        }

        const filledWithMissing = {
          brk: false,
          cts: true,
          dtr: true,
          rts: false,
        }

        const port = new SerialPortStream(openOpts, () => {
          const spy = sandbox.spy(port.port!, 'set')
          port.set(settings, err => {
            assert.isNull(err)
            assert(spy.calledWith(filledWithMissing))
            done()
          })
        })
      })

      it('resets all flags if none are provided', done => {
        const defaults = {
          brk: false,
          cts: false,
          dtr: true,
          rts: true,
        }

        const port = new SerialPortStream(openOpts, () => {
          const spy = sandbox.spy(port.port!, 'set')
          port.set({}, err => {
            assert.isNull(err)
            assert(spy.calledWith(defaults))
            done()
          })
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.once('open', () => {
          sinon.stub(port.port!, 'set').callsFake(() => {
            return Promise.reject(new Error('like tears in the rain'))
          })
          port.set({}, err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('handles errors in event', done => {
        const port = new SerialPortStream(openOpts)
        port.once('open', () => {
          sinon.stub(port.port!, 'set').callsFake(() => {
            return Promise.reject(new Error('attack ships on fire off the shoulder of Orion'))
          })
          port.set({})
        })
        port.on('error', err => {
          assert.instanceOf(err, Error)
          done()
        })
      })
    })

    describe('#flush', () => {
      it('errors when serialport not open', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.flush(err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('calls flush on the bindings', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          const spy = sinon.spy(port.port!, 'flush')
          port.flush(err => {
            assert.isNull(err)
            assert(spy.calledOnce)
            done()
          })
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'flush').callsFake(() => {
            return Promise.reject(new Error('like tears in the rain'))
          })
          port.flush(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('handles errors in event', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'flush').callsFake(() => {
            return Promise.reject(new Error('attack ships on fire off the shoulder of Orion'))
          })
          port.flush()
        })
        port.on('error', err => {
          assert.instanceOf(err, Error)
          done()
        })
      })
    })

    describe('#drain', () => {
      it('waits for an open port', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.drain(err => {
          assert.isNull(err)
          done()
        })
        port.open()
      })

      it('calls drain on the bindings', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          const spy = sinon.spy(port.port!, 'drain')
          port.drain(err => {
            assert.isNull(err)
            assert(spy.calledOnce)
            done()
          })
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'drain').callsFake(() => {
            return Promise.reject(new Error('like tears in the rain'))
          })
          port.drain(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })

      it('handles errors in event', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'drain').callsFake(() => {
            return Promise.reject(new Error('attack ships on fire off the shoulder of Orion'))
          })
          port.drain()
        })
        port.on('error', err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('waits for in progress or queued writes to finish', done => {
        const port = new SerialPortStream(openOpts)
        port.on('error', done)
        let finishedWrite = false
        port.write(Buffer.alloc(10), () => {
          finishedWrite = true
        })
        port.drain(() => {
          assert.isTrue(finishedWrite)
          done()
        })
      })
    })

    describe('#get', () => {
      it('errors when serialport not open', done => {
        const port = new SerialPortStream({ ...openOpts, autoOpen: false })
        port.get(err => {
          assert.instanceOf(err, Error)
          done()
        })
      })

      it('gets the status from the ports bindings', done => {
        const port = new SerialPortStream(openOpts, () => {
          const spy = sandbox.spy(port.port!, 'get')
          port.get((err, status) => {
            assert.isNull(err)
            assert(spy.calledOnce)
            assert.deepEqual(status, {
              cts: true,
              dsr: false,
              dcd: false,
            })
            done()
          })
        })
      })

      it('handles errors in callback', done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          sinon.stub(port.port!, 'get').callsFake(() => {
            return Promise.reject(new Error('like tears in the rain'))
          })
          port.get(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })
    })

    describe('#destroy', () => {
      it('calls close', done => {
        const port = new SerialPortStream(openOpts)
        port.on('close', () => done())
        port.destroy()
      })

      it("doesn't open after destroy", done => {
        const port = new SerialPortStream(openOpts)
        port.on('open', () => {
          port.destroy()
          assert.isTrue(port.destroyed)
          port.open(err => {
            assert.instanceOf(err, Error)
            done()
          })
        })
      })
    })
  })

  describe('reading data', () => {
    it('emits data events by default', done => {
      const testData = Buffer.from('I am a really short string')
      const port = new SerialPortStream(openOpts, () => {
        port.once('data', recvData => {
          assert.deepEqual(recvData, testData)
          done()
        })
        port.port!.write(testData)
      })
    })

    it('emits data events with resuming', async () => {
      const testData = Buffer.from('I am a really short string')
      const port = new SerialPortStream<MockBindingInterface>({ ...openOpts })
      await new Promise(resolve => port.on('open', resolve))
      await new Promise(resolve => port.write(testData, resolve))
      await new Promise(resolve => port.once('readable', resolve))
      const data1 = port.read()
      await new Promise(resolve => port.write(testData, resolve))
      await new Promise(resolve => port.once('readable', resolve))
      const data2 = port.read()
      assert.deepEqual(Buffer.concat([data1, data2]), Buffer.concat([testData, testData]))
    })

    it('reads more data than the high water mark', async () => {
      const testData = randomBytes((64 * 1024) / 2 + 1)
      MockBinding.createPort('/dev/exists', { echo: true, maxReadSize: testData.length })
      const port = new SerialPortStream(openOpts)
      await new Promise(resolve => port.on('open', resolve))
      await new Promise(resolve => port.write(testData, resolve))
      await new Promise(resolve => port.once('readable', resolve))
      const data1 = port.read()
      await new Promise(resolve => port.write(testData, resolve))
      await new Promise(resolve => port.once('readable', resolve))
      const data2 = port.read()
      await new Promise(resolve => port.once('readable', resolve))
      const data3 = port.read()
      assert.deepEqual(Buffer.concat([data1, data2, data3]), Buffer.concat([testData, testData]))
    })

    it('reads more data than the high water mark at once', async () => {
      const testData = randomBytes(64 * 1024 + 1)
      MockBinding.createPort('/dev/exists', { echo: true, maxReadSize: testData.length })
      const port = new SerialPortStream(openOpts)
      await new Promise(resolve => port.on('open', resolve))
      await new Promise(resolve => port.write(testData, resolve))
      await new Promise(resolve => port.once('readable', resolve))
      const data1 = port.read()
      await new Promise(resolve => port.once('readable', resolve))
      const data2 = port.read()
      assert.deepEqual(Buffer.concat([data1, data2]), testData)
    })

    it("doesn't error if the port is closed when reading", async () => {
      const port = new SerialPortStream(openOpts)
      await new Promise(resolve => port.on('open', resolve))
      port.read()
      port.read()
      let err = null
      port.on('error', error => (err = error))
      await new Promise<void>((resolve, reject) => port.close(err => (err ? reject(err) : resolve())))
      assert.isNull(err)
    })
  })

  describe('disconnect close errors', () => {
    it('emits as a disconnected close event on a bad read', done => {
      const port = new SerialPortStream(openOpts, () => {
        sinon.stub(port.port!, 'read').callsFake(async () => {
          throw new Error('EBAD_ERR')
        })
        port.read()
      })
      port.on('close', (err: DisconnectedError | undefined) => {
        assert.instanceOf(err, DisconnectedError)
        assert.isTrue(err!.disconnected)
        done()
      })
      port.on('error', done) // this shouldn't be called
    })
  })
})
