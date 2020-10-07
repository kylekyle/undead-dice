# encoding: UTF-8

require 'roda'
require 'concode'
require 'seconds'
require 'concurrent'
require 'message_bus'
require 'dotenv/load'
require 'securerandom'

GAMES = Concurrent::Map.new

MessageBus.configure(backend: :memory)

class UndeadDice < Roda
  plugin :halt
  plugin :json
  plugin :public
  plugin :message_bus
  plugin :status_handler
  plugin :typecast_params
  plugin :slash_path_empty
  plugin :render, engine: 'slim'
  plugin :sessions, secret: ENV['SESSION_SECRET']

  unless ENV['RACK_ENV'] == 'development'
    plugin :content_security_policy do |csp|
      csp.default_src :none
      csp.style_src :self
      csp.script_src :self
      csp.font_src :self
      csp.img_src :self
      csp.connect_src :self
      csp.form_action :self
      csp.base_uri :none
      csp.frame_ancestors :none
      csp.block_all_mixed_content
      csp.upgrade_insecure_requests
    end
  end
  
  use Rack::CommonLogger

  status_handler(404) do
    view :card, locals: {
      title: '¯\_(ツ)_/¯', 
      text: "Hm. Nothing here. That's weird. Oh well!"
    }
  end

  def self.new_game
    { 
      board: [], 
      queue: [],
      active: Time.now,
      lock: Concurrent::Semaphore.new(1)
    }
  end

  # TODO: delete this
  GAMES['test'] = new_game()

  route do |r|
    r.public

    r.root do 
      view :home
    end

    r.on 'debug' do 
      puts ENV['SESSION_SECRET']
      session.map{|k,v| "#{k}: #{v}"}.join('<br>')
    end

    r.on 'new' do 
      r.get do
        if session['admin'] 
          code = Concode::Generator.new.generate SecureRandom.hex
          GAMES[code] = new_game()
          r.redirect code
        else
          view :new
        end
      end

      r.post do 
        if r.POST['password'] == ENV['PASSWORD']
          session['admin'] = true 
        end

        r.redirect
      end
    end

    r.on GAMES.keys do |code|
      r.message_bus
      game = GAMES[code]

      r.is do
        r.get do 
          render :game
        end
        
        r.post do
          typecast_params.nonempty_str! 'action'
          
          # this is very probably unecessary, but since two users could
          # modify the game state simultaneously, it seems prudent
          game[:lock].acquire

          case r.POST['action']
          
          when 'pull'
            die = {
              id: SecureRandom.hex,
              color: [:red, :green, :yellow].sample
            }

            game[:queue] << die
            MessageBus.publish "/#{code}", { die: die, action: :pull }
          
          when 'roll' 
            game[:queue].each do |die|
              die[:face] = rand(0..5)
              game[:board] << die
            end
            
            MessageBus.publish "/#{code}", { 
              action: :roll, dice: game[:queue]
            }

            game[:queue].clear
          
          else
            r.halt 400, "unreconized action '#{r.POST['action']}'"
          end

          'done'
        ensure 
          game[:lock].release
        end
      end
    end
  end
end

run UndeadDice.freeze.app